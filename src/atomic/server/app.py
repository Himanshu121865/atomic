import asyncio
import dataclasses
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket
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
from atomic.constants import BOHR_RADIUS_PM, HARTREE_EV
from atomic.provenance import Fidelity, Field, Provenance, Quantity
from atomic.server.jobs import Job, JobStatus, JobStore
from atomic.server.sample_hydrogen import SampleJobResult, sample_hydrogen
from atomic.server.schemas import (
    ChannelModel,
    FieldModel,
    ProvenanceModel,
    QuantityModel,
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
    jobs = JobStore()
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
        return SystemsResponse(systems=[SystemModel.from_system(s) for s in list_systems()])

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

    @app.get("/api/levels", response_model=LevelsResponse)
    def levels(system: str = "h", n_max: int = 6) -> LevelsResponse:
        if not 1 <= n_max <= 20:
            raise HTTPException(status_code=422, detail="n_max must be in [1, 20]")
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

    @app.post("/api/jobs/sample", response_model=JobModel)
    async def create_sample_job(req: SampleRequest) -> JobModel:
        _validate_state(req.n, req.l, req.m)
        sys_ = _resolve_system(req.system)
        job = jobs.create()
        app.state.job_systems[job.id] = req.system

        def work(progress):
            result = sample_hydrogen(
                req.n, req.l, req.m, req.count,
                Z=sys_.Z, mu_ratio=sys_.mu_ratio.value,
                seed=req.seed, basis=req.basis,
                progress=lambda f: progress(0.95 * f),
            )
            progress(1.0)
            return result

        return _dispatch(job, work)

    @app.get("/api/jobs/{job_id}", response_model=JobModel)
    def job_status(job_id: str) -> JobModel:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"unknown job: {job_id}")
        return _job_model(job)

    def _sample_meta(res: SampleJobResult, system_key: str) -> SampleMetaModel:
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
            system=system_key,
            provenance=ProvenanceModel.from_provenance(cloud.provenance),
            channels=channels,
        )

    @app.get("/api/jobs/{job_id}/meta", response_model=SampleMetaModel)
    def job_meta(job_id: str) -> SampleMetaModel:
        res = _finished_result(jobs, job_id)
        system_key = app.state.job_systems.get(job_id, "h")
        return _sample_meta(res, system_key)

    @app.get("/api/jobs/{job_id}/data")
    def job_data(job_id: str, channel: str | None = None) -> Response:
        res = _finished_result(jobs, job_id)
        if (channel or "positions") == "positions":
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
