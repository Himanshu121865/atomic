import asyncio
import dataclasses
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydantic import Field as PydanticField

import atomic
from atomic.analytic.hydrogen import (
    angular_momentum_magnitude,
    energy,
    mean_radius,
    radial_wavefunction,
    validate_quantum_numbers,
)
from atomic.analytic.wavefunction import WavefunctionValues, evaluate_state
from atomic.atoms import (
    ATOM_KEYS,
    SUBSHELL_LABELS,
    atom_for_key,
    aufbau_configuration,
    format_config,
    has_gsz_parameters,
    is_atom_key,
)
from atomic.classical import classical_ghost
from atomic.constants import BOHR_RADIUS_PM, HARTREE_EV
from atomic.constants_lab import analyze_constants
from atomic.numerics.expression import ExpressionError
from atomic.numerics.force_law import PRESETS, force_law_levels, free_form_levels
from atomic.plane import PlaneGrid, plane_grid, screened_plane_grid
from atomic.provenance import Fidelity, Field, Provenance, Quantity
from atomic.sampling import SampleCloud, sample_density, sample_screened_density
from atomic.screened_atom import (
    evaluate_screened_state,
    screened_radial,
    solve_screened_atom,
)
from atomic.server.jobs import Job, JobStatus, JobStore
from atomic.server.schemas import (
    ChannelModel,
    ClassicalGhostModel,
    ConstantsReportModel,
    FieldModel,
    ForceLawModel,
    ProvenanceModel,
    QuantityModel,
    ScreenedLevelsModel,
    ScreenedOrbitalModel,
    SystemModel,
)
from atomic.systems import get_system, hydrogen_like, list_systems

_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

logger = logging.getLogger(__name__)


def _configure_logging() -> None:
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(message)s")


def _web_dist() -> Path:
    override = os.environ.get("ATOMIC_WEB_DIST")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[3] / "web" / "dist"


def _job_worker_count() -> int:
    override = os.environ.get("ATOMIC_JOB_WORKERS")
    if override:
        return max(1, int(override))
    return max(2, min(4, os.cpu_count() or 2))


class LevelEntry(BaseModel):
    n: int
    energy: QuantityModel
    energy_ev: QuantityModel
    degeneracy: int


class LevelsResponse(BaseModel):
    system: SystemModel
    n_max: int
    levels: list[LevelEntry]


class StateResponse(BaseModel):
    n: int
    l: int
    m: int
    system: SystemModel
    energy: QuantityModel
    energy_ev: QuantityModel
    mean_radius: QuantityModel
    mean_radius_pm: QuantityModel
    angular_momentum: QuantityModel
    radial_nodes: int
    angular_nodes: int


class SystemsResponse(BaseModel):
    systems: list[SystemModel]


class RadialResponse(BaseModel):
    n: int
    l: int
    system: SystemModel
    r_wavefunction: FieldModel
    radial_probability: FieldModel


class SampleRequest(BaseModel):
    n: int
    l: int
    m: int
    count: int = PydanticField(default=100_000, ge=1_000, le=1_000_000)
    seed: int = 0
    basis: Literal["complex", "real"] = "complex"
    system: str = "h"


class JobModel(BaseModel):
    id: str
    status: str
    progress: float
    error: str | None


class SampleMetaModel(BaseModel):
    kind: Literal["sample"] = "sample"
    count: int
    dtype: str
    layout: str
    unit: str
    n: int
    l: int
    m: int
    basis: str
    system: str
    model: str = "hydrogenic"
    provenance: ProvenanceModel
    channels: list[ChannelModel]


class PlaneRequest(BaseModel):
    n: int
    l: int
    m: int
    quantity: Literal["density", "psi"] = "density"
    basis: Literal["complex", "real"] = "complex"
    system: str = "h"
    resolution: int = 256


@dataclasses.dataclass(frozen=True)
class SampleJobResult:
    cloud: SampleCloud
    psi: WavefunctionValues


class PlaneMetaModel(BaseModel):
    kind: Literal["plane"] = "plane"
    resolution: int
    dtype: str
    layout: str
    quantity: str
    unit: str
    label: str
    half_extent: float
    axis_unit: str
    n: int
    l: int
    m: int
    basis: str
    system: str
    model: str = "hydrogenic"
    provenance: ProvenanceModel


def _validate_state(n: int, l: int, m: int) -> None:
    try:
        validate_quantum_numbers(n, l)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if abs(m) > l:
        raise HTTPException(status_code=422, detail=f"|m| must be <= l, got m={m}, l={l}")


def _resolve_system(key: str):
    try:
        return get_system(key)
    except KeyError:
        match = re.fullmatch(r"z(\d+)", key.strip().lower())
        if match:
            return hydrogen_like(int(match.group(1)))
        available = [s.key for s in list_systems()]
        raise HTTPException(
            status_code=404, detail=f"unknown system {key!r}; available: {available}"
        ) from None


def _screened_element(key: str):
    element = atom_for_key(key)
    if not has_gsz_parameters(element.z):
        raise HTTPException(
            status_code=400,
            detail=(
                f"{element.name} has no published GSZ screening parameters: "
                f"Szydlik and Green (1974) tabulate neutral He to P and Ar "
                f"and skip Z = 16 and 17."
            ),
        )
    return element


def _to_ev(q: Quantity) -> Quantity:
    return Quantity(
        value=q.value * HARTREE_EV,
        unit="eV",
        label=q.label + " [eV]",
        provenance=dataclasses.replace(
            q.provenance,
            method=q.provenance.method + "; converted to eV via CODATA Hartree-eV factor",
        ),
    )


def _to_pm(q: Quantity) -> Quantity:
    return Quantity(
        value=q.value * BOHR_RADIUS_PM,
        unit="pm",
        label=q.label + " [pm]",
        provenance=dataclasses.replace(
            q.provenance,
            method=q.provenance.method + "; converted to pm via CODATA Bohr radius",
        ),
    )


def _job_model(job: Job) -> JobModel:
    return JobModel(id=job.id, status=job.status.value, progress=job.progress, error=job.error)


def _finished_result(jobs: JobStore, job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"unknown job: {job_id}")
    if job.status is not JobStatus.DONE:
        raise HTTPException(status_code=409, detail=f"job is {job.status.value}, not done")
    return job.result


def create_app() -> FastAPI:
    _configure_logging()
    app = FastAPI(title="atomic", version=atomic.__version__)
    app.state.job_systems = {}
    app.state.job_models = {}

    def _forget_job(job_id: str) -> None:
        app.state.job_systems.pop(job_id, None)
        app.state.job_models.pop(job_id, None)

    jobs = JobStore(on_evict=_forget_job)
    app.state.jobs = jobs
    app.state.executor = ThreadPoolExecutor(
        max_workers=_job_worker_count(), thread_name_prefix="atomic-job"
    )
    app.add_middleware(
        CORSMiddleware, allow_origins=_DEV_ORIGINS, allow_methods=["*"], allow_headers=["*"]
    )
    app.state.rate_limit = None

    def _dispatch(job: Job, work) -> JobModel:
        app.state.executor.submit(jobs.run, job.id, work)
        return _job_model(jobs.get(job.id))

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": atomic.__version__}

    @app.get("/api/systems", response_model=SystemsResponse)
    def systems() -> SystemsResponse:
        hydrogenic = [SystemModel.from_system(s) for s in list_systems()]
        screened = [
            SystemModel.from_atom(
                atom_for_key(k), atom_for_key(k).z,
                f"{atom_for_key(k).name}: GSZ screened central-field model (APPROXIMATION).",
            )
            for k in ATOM_KEYS if has_gsz_parameters(atom_for_key(k).z)
        ]
        return SystemsResponse(systems=hydrogenic + screened)

    @app.get("/api/state/{n}/{l}/{m}", response_model=StateResponse)
    def state(n: int, l: int, m: int, system: str = "h") -> StateResponse:
        _validate_state(n, l, m)
        sys_ = _resolve_system(system)
        mu = sys_.mu_ratio.value
        e = energy(n, Z=sys_.Z, mu_ratio=mu)
        mr = mean_radius(n, l, Z=sys_.Z, mu_ratio=mu)
        return StateResponse(
            n=n, l=l, m=m,
            system=SystemModel.from_system(sys_),
            energy=QuantityModel.from_quantity(e),
            energy_ev=QuantityModel.from_quantity(_to_ev(e)),
            mean_radius=QuantityModel.from_quantity(mr),
            mean_radius_pm=QuantityModel.from_quantity(_to_pm(mr)),
            angular_momentum=QuantityModel.from_quantity(angular_momentum_magnitude(l)),
            radial_nodes=n - l - 1,
            angular_nodes=l,
        )

    @app.get("/api/levels", response_model=LevelsResponse | ScreenedLevelsModel)
    def levels(system: str = "h", n_max: int = 6) -> LevelsResponse | ScreenedLevelsModel:
        if not 1 <= n_max <= 20:
            raise HTTPException(status_code=422, detail="n_max must be in [1, 20]")
        if is_atom_key(system):
            element = _screened_element(system)
            result = solve_screened_atom(
                element.z, element.z, aufbau_configuration(element.z)
            )
            return ScreenedLevelsModel(
                system=SystemModel.from_atom(
                    element, element.z, f"{element.name}: GSZ screened central-field model",
                ),
                config=format_config(result.config),
                is_ground=result.is_ground,
                orbitals=[
                    ScreenedOrbitalModel(
                        n=o.n, l=o.l,
                        label=f"{o.n}{SUBSHELL_LABELS[o.l]}{o.occupancy}",
                        occupancy=o.occupancy,
                        energy=QuantityModel.from_quantity(o.energy),
                        energy_ev=QuantityModel.from_quantity(_to_ev(o.energy)),
                    )
                    for o in result.orbitals
                ],
                total_energy=QuantityModel.from_quantity(result.total_energy),
                total_energy_ev=QuantityModel.from_quantity(_to_ev(result.total_energy)),
            )
        sys_ = _resolve_system(system)
        mu = sys_.mu_ratio.value
        entries = []
        for n in range(1, n_max + 1):
            e = energy(n, Z=sys_.Z, mu_ratio=mu)
            entries.append(
                LevelEntry(
                    n=n,
                    energy=QuantityModel.from_quantity(e),
                    energy_ev=QuantityModel.from_quantity(_to_ev(e)),
                    degeneracy=2 * n * n,
                )
            )
        return LevelsResponse(system=SystemModel.from_system(sys_), n_max=n_max, levels=entries)

    @app.get("/api/radial/{n}/{l}", response_model=RadialResponse)
    def radial(n: int, l: int, system: str = "h", points: int = 400) -> RadialResponse:
        _validate_state(n, l, 0)
        if not 50 <= points <= 2000:
            raise HTTPException(status_code=422, detail="points must be in [50, 2000]")
        if is_atom_key(system):
            element = _screened_element(system)
            rw, prob = screened_radial(element.z, element.z, n, l, points=points)
            return RadialResponse(
                n=n, l=l,
                system=SystemModel.from_atom(
                    element, element.z, f"{element.name}: GSZ screened central-field model",
                ),
                r_wavefunction=FieldModel.from_field(rw),
                radial_probability=FieldModel.from_field(prob),
            )
        sys_ = _resolve_system(system)
        mu = sys_.mu_ratio.value
        r_max = min(400.0, 60.0 * n * n / (sys_.Z * mu))
        grid = np.linspace(0.0, r_max, points)
        rw = radial_wavefunction(n, l, grid, Z=sys_.Z, mu_ratio=mu)
        prob = Field(
            values=(np.abs(rw.values) ** 2 * grid**2),
            grid=grid,
            unit="bohr^-1",
            grid_unit="bohr",
            label=f"P_{n},{l}(r) (Z={sys_.Z})",
            provenance=Provenance(
                fidelity=Fidelity.EXACT,
                method="P(r) = |R_nl(r)|^2 r^2 from the closed-form R_nl",
                assumptions=rw.provenance.assumptions,
            ),
        )
        return RadialResponse(
            n=n, l=l,
            system=SystemModel.from_system(sys_),
            r_wavefunction=FieldModel.from_field(rw),
            radial_probability=FieldModel.from_field(prob),
        )

    @app.get("/api/constants", response_model=ConstantsReportModel)
    def constants_endpoint(
        hbar: float = 1.0, e: float = 1.0, m_e: float = 1.0,
        eps0: float = 1.0, c: float = 1.0,
    ) -> ConstantsReportModel:
        for name, mult in (("hbar", hbar), ("e", e), ("m_e", m_e),
                           ("eps0", eps0), ("c", c)):
            if not 0.25 <= mult <= 4.0:
                raise HTTPException(
                    status_code=422,
                    detail=f"{name} multiplier must be in [0.25, 4], got {mult}",
                )
        return ConstantsReportModel.from_report(
            analyze_constants(hbar=hbar, e=e, m_e=m_e, eps0=eps0, c=c)
        )

    @app.get("/api/classical", response_model=ClassicalGhostModel)
    def classical_endpoint(system: str = "h", n: int = 1) -> ClassicalGhostModel:
        if n < 1:
            raise HTTPException(status_code=422, detail=f"n must be >= 1, got {n}")
        sys_ = _resolve_system(system)
        return ClassicalGhostModel.from_ghost(classical_ghost(n=n, system=sys_))

    @app.get("/api/forcelaw", response_model=ForceLawModel)
    def forcelaw_endpoint(
        preset: str = "powerlaw",
        l: int = 0,
        system: str = "h",
        n_states: int = 4,
        p: float = 1.0,
        lambda_: float = Query(default=3.0, alias="lambda"),
        omega: float = 0.3,
        v0: float = 2.0,
        a: float = 3.0,
        core: float = 0.2,
        expr: str | None = None,
    ) -> ForceLawModel:
        if l < 0:
            raise HTTPException(status_code=422, detail=f"l must be >= 0, got {l}")
        if not 1 <= n_states <= 8:
            raise HTTPException(
                status_code=422, detail=f"n_states must be in [1, 8], got {n_states}"
            )
        sys_ = _resolve_system(system)

        if preset == "custom":
            if not expr or not expr.strip():
                raise HTTPException(status_code=422, detail="custom preset requires 'expr'")
            try:
                result = free_form_levels(expr, l=l, system=sys_, n_states=n_states)
            except (ExpressionError, ValueError) as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
        else:
            if preset not in PRESETS:
                raise HTTPException(
                    status_code=422,
                    detail=f"unknown preset {preset!r}; known: {sorted(PRESETS)}",
                )
            supplied = {
                "p": p, "lambda": lambda_, "omega": omega, "v0": v0, "a": a, "core": core,
            }
            params = {spec.name: supplied[spec.name] for spec in PRESETS[preset].params}
            try:
                result = force_law_levels(preset, params, l=l, system=sys_, n_states=n_states)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc

        return ForceLawModel.from_result(result, SystemModel.from_system(sys_), _to_ev)

    @app.post("/api/jobs/sample", response_model=JobModel)
    async def create_sample_job(req: SampleRequest) -> JobModel:
        _validate_state(req.n, req.l, req.m)
        job = jobs.create()
        app.state.job_systems[job.id] = req.system

        if is_atom_key(req.system):
            element = _screened_element(req.system)
            app.state.job_models[job.id] = "screened"

            def work(progress):
                cloud = sample_screened_density(
                    element.z, element.z, req.n, req.l, req.m, req.count,
                    seed=req.seed, progress=lambda f: progress(0.9 * f), basis=req.basis,
                )
                psi = evaluate_screened_state(
                    element.z, element.z, req.n, req.l, req.m,
                    cloud.positions.astype(np.float64), basis=req.basis,
                )
                progress(1.0)
                return SampleJobResult(cloud=cloud, psi=psi)

            return _dispatch(job, work)

        sys_ = _resolve_system(req.system)
        app.state.job_models[job.id] = "hydrogenic"

        def work(progress):
            cloud = sample_density(
                req.n, req.l, req.m, req.count,
                Z=sys_.Z, mu_ratio=sys_.mu_ratio.value,
                seed=req.seed, progress=lambda f: progress(0.9 * f), basis=req.basis,
            )
            psi = evaluate_state(
                req.n, req.l, req.m, cloud.positions.astype(np.float64),
                Z=sys_.Z, mu_ratio=sys_.mu_ratio.value, basis=req.basis,
            )
            progress(1.0)
            return SampleJobResult(cloud=cloud, psi=psi)

        return _dispatch(job, work)

    @app.post("/api/jobs/plane", response_model=JobModel)
    async def create_plane_job(req: PlaneRequest) -> JobModel:
        _validate_state(req.n, req.l, req.m)
        if not 16 <= req.resolution <= 1024:
            raise HTTPException(status_code=422, detail="resolution must be in [16, 1024]")
        job = jobs.create()
        app.state.job_systems[job.id] = req.system

        if is_atom_key(req.system):
            element = _screened_element(req.system)
            app.state.job_models[job.id] = "screened"

            def work(progress):
                return screened_plane_grid(
                    element.z, element.z, req.n, req.l, req.m,
                    quantity=req.quantity, basis=req.basis,
                    resolution=req.resolution, progress=progress,
                )

            return _dispatch(job, work)

        sys_ = _resolve_system(req.system)
        app.state.job_models[job.id] = "hydrogenic"

        def work(progress):
            return plane_grid(
                req.n, req.l, req.m, quantity=req.quantity, basis=req.basis,
                Z=sys_.Z, mu_ratio=sys_.mu_ratio.value,
                resolution=req.resolution, progress=progress,
            )

        return _dispatch(job, work)

    @app.get("/api/jobs/{job_id}", response_model=JobModel)
    def job_status(job_id: str) -> JobModel:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"unknown job: {job_id}")
        return _job_model(job)

    def _sample_meta(
        res: SampleJobResult, system_key: str, model_key: str
    ) -> SampleMetaModel:
        cloud = res.cloud
        channels = [
            ChannelModel(
                name="positions", dtype="float32", unit="bohr",
                provenance=ProvenanceModel.from_provenance(cloud.provenance),
            ),
            ChannelModel(
                name="density", dtype="float32", unit="bohr^-3",
                provenance=ProvenanceModel.from_provenance(res.psi.provenance),
            ),
        ]
        if cloud.basis == "complex":
            channels.append(
                ChannelModel(
                    name="phase", dtype="float32", unit="rad",
                    provenance=ProvenanceModel.from_provenance(res.psi.provenance),
                )
            )
        return SampleMetaModel(
            count=cloud.positions.shape[0], dtype="float32", layout="xyz-interleaved",
            unit="bohr", n=cloud.n, l=cloud.l, m=cloud.m, basis=cloud.basis,
            system=system_key, model=model_key,
            provenance=ProvenanceModel.from_provenance(cloud.provenance),
            channels=channels,
        )

    def _plane_meta(
        pg: PlaneGrid, system_key: str, model_key: str
    ) -> PlaneMetaModel:
        return PlaneMetaModel(
            resolution=pg.values.shape[0], dtype="float32",
            layout="row-major float32; row i = z ascending, col j = x ascending",
            quantity=pg.quantity, unit=pg.unit, label=pg.label,
            half_extent=float(pg.axis[-1]), axis_unit="bohr",
            n=pg.n, l=pg.l, m=pg.m, basis=pg.basis, system=system_key,
            model=model_key,
            provenance=ProvenanceModel.from_provenance(pg.provenance),
        )

    @app.get("/api/jobs/{job_id}/meta", response_model=SampleMetaModel | PlaneMetaModel)
    def job_meta(job_id: str) -> SampleMetaModel | PlaneMetaModel:
        res = _finished_result(jobs, job_id)
        system_key = app.state.job_systems.get(job_id, "h")
        model_key = app.state.job_models.get(job_id, "hydrogenic")
        if isinstance(res, PlaneGrid):
            return _plane_meta(res, system_key, model_key)
        return _sample_meta(res, system_key, model_key)

    @app.get("/api/jobs/{job_id}/data")
    def job_data(job_id: str, channel: str | None = None) -> Response:
        res = _finished_result(jobs, job_id)
        if isinstance(res, PlaneGrid):
            if channel is not None:
                raise HTTPException(
                    status_code=422, detail="plane jobs have a single channel"
                )
            payload = res.values.astype(np.float32)
        elif (channel or "positions") == "positions":
            payload = res.cloud.positions
        elif channel == "density":
            payload = (np.abs(res.psi.values) ** 2).astype(np.float32)
        elif channel == "phase" and res.cloud.basis == "complex":
            payload = np.angle(res.psi.values).astype(np.float32)
        else:
            raise HTTPException(status_code=422, detail=f"no channel {channel!r} on this job")
        return Response(
            content=payload.tobytes(), media_type="application/octet-stream"
        )

    @app.websocket("/ws/jobs/{job_id}")
    async def job_progress(ws: WebSocket, job_id: str) -> None:
        await ws.accept()
        while True:
            job = jobs.get(job_id)
            if job is None:
                await ws.send_json({"status": "error", "progress": 0.0, "error": "unknown job"})
                break
            await ws.send_json(
                {"status": job.status.value, "progress": job.progress, "error": job.error}
            )
            if job.status in (JobStatus.DONE, JobStatus.ERROR):
                break
            await asyncio.sleep(0.1)
        await ws.close()

    web_dist = _web_dist()
    if web_dist.is_dir():
        app.mount("/", StaticFiles(directory=str(web_dist), html=True), name="web")
        logger.info("Mounted the UI from %s", web_dist)
    else:
        logger.warning("No UI found at %s; serving the API only", web_dist)

    return app
