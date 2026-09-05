# agent.md — how to work on atomic, in 15 phases

This file is the agent entry point. Read it before touching code.
`docs/` is append-only and may be stale. Code is current truth.

Reference: `../AtomSim/agent.md` — copy from there if stuck (`s/atomsim/atomic/`).

## 1. Prime directive

Every value crossing a module boundary is a `Quantity` or `Field` with `Provenance`.
See `src/atomic/provenance.py`. Tiers: `EXACT` / `NUMERICAL` / `APPROXIMATION` /
`COUNTERFACTUAL` / `VISUAL_LIBERTY`. A bare `float`, silent zero, or undisclosed
visual choice is a bug. Counterfactual work stays under a `COUNTERFACTUAL` banner.

## 2. Repo map

| Path | What lives there |
|---|---|
| `src/atomic/provenance.py`, `constants.py`, `systems.py`, `atoms.py` | spine: fidelity, CODATA, systems, elements |
| `src/atomic/analytic/`, `numerics/` | `hydrogen→hyperfine`, `mesh→marching_tets` |
| `screened_atom.py`, `hf_atom.py`, `hf_reference.py`, `spectra.py`, `populations.py`, `broadening.py`, `transfer.py` | atoms + light |
| `sampling.py`, `plane.py`, `isosurface.py`, `density_compare.py`, `constants_lab.py`, `classical.py` | sampling/views + What-If |
| `src/atomic/server/` | `app.py:create_app()`, `schemas.py` (JSON authority), `jobs.py`, `ratelimit.py`, `thumbnails.py` |
| `src/atomic/cli.py`, `__main__.py` | `atomic serve [--port 8000] [--no-browser]` |
| `src/atomic/data/` | vendored NIST `nist_h/d/he/li/na_i.json` + `hf_reference_energies.json` (no live queries) |
| `web/src/` | `App.tsx`, `state/store.ts`, `api/{client,types}.ts`, `lib/`, `components/`, `tours/` |
| `tests/test_*.py`, `web/**/*.test.ts` | evidence-style suite, see §4 |
| `docs/specs/`, `docs/plans/`, `docs/notes/` | design record; `docs/README.md` is the index |
| `scripts/` | `convergence_study.py`, `gen_luts.py`, `smoke_container.sh` |
| `Dockerfile`, `fly.toml`, `environment.yml`, `pyproject.toml` | container / deploy / env / packaging |

Server routes (`src/atomic/server/app.py`): `GET health, systems, state/{n}/{l}/{m},
levels, constants, classical, forcelaw, radial/{n}/{l}, spectrum, absorption,
curve-of-growth, thumbnail/{n}/{l}/{m}` + `POST jobs/sample|plane|isosurface|hf` +
`GET jobs/{id}[/meta|/data]` + `WS jobs/{id}`. Single-machine only.

## 3. Commands

```bash
conda env create -f environment.yml && conda activate atomic
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
source .venv/bin/activate
atomic serve
cd web && npm ci && npm run build && cd ..
pytest && ruff check .
cd web && npm test && npm run build
bash scripts/smoke_container.sh atomic:ci
python scripts/convergence_study.py && python scripts/gen_luts.py
```

CI (`.github/workflows/ci.yml`): `python` (ruff + pytest), `web` (ci/test/build),
`container` (build + smoke), `deploy` (`flyctl deploy --ha=false`, main only).

## 4. Agent workflow

1. Read spec + plan in `docs/specs/`, `docs/plans/`. Engine → schemas → route → view.
2. Keep `server/schemas.py` ↔ `web/src/api/types.ts` in sync.
3. Tests are evidence, not coverage: solver-vs-analytic, halving rate, KS sampling,
   vendored-NIST, HF-vs-reference. Physics regressions fail CI.
4. Run `ruff`, `pytest`, `npm test/build` for the touched area. Regen notes/LUTs as needed.
5. No live NIST, no multi-machine, no `fastapi/uvicorn/matplotlib` at CLI scope.
6. Don't reintroduce: S(16)/Cl(17) need `model=hf`; HF capped `_MAX_N=3,_MAX_Z=36`;
   K-4s stagnates; `<900px` needs a real layout.

## 5. 15 phases

Work in order. Each phase lists goal, key files, and done criteria.
Status: Phase 0 done (34 tests green, 2026-09-05); Phases 1–14 pending.

### Phase 0 — Foundation and provenance spine
Goal: importable package, fidelity system, constants, mesh, CI.
Files: `provenance.py`, `constants.py`, `numerics/mesh.py`, `__init__.py`, `pyproject.toml`, `environment.yml`, `ci.yml`.
Original: AtomSim Phase 0 + requirements spec.
Done: `pytest tests/test_{provenance,constants,mesh}.py` green; `ruff` clean.

### Phase 1 — Hydrogen in closed form
Goal: exact energies (D/T, muonic, positronium), orbitals, systems registry.
Files: `analytic/hydrogen.py`, `wavefunction.py`, `angular.py`, `systems.py`, `atoms.py`.
Original: AtomSim Phase 1.
Done: normalization, orthogonality, node counts, `<r>` formulas pass.

### Phase 2 — Numerical radial solver
Goal: finite-difference solver vs Phase 1, virial, halving rate, note.
Files: `numerics/radial_solver.py`, `numerics/analysis.py`, `scripts/convergence_study.py`, `docs/notes/phase0-convergence.md`.
Original: AtomSim Phase 2.
Done: Coulomb-vs-analytic + observed order recorded.

### Phase 3 — CLI, server skeleton, jobs
Goal: `atomic serve`, `create_app()`, schemas, jobs + WS, thumbnails, `web/dist` mount.
Files: `cli.py`, `server/app.py`, `schemas.py`, `jobs.py`, `thumbnails.py`.
Original: AtomSim Phase 3 (M1 + web-hosting).
Done: `pytest tests/test_{server,jobs,schemas,cli}.py` green; `--help` fast.

### Phase 4 — Web instrument shell
Goal: App, store, URL state, API client, Cloud/Plane/Levels/Radial, badges.
Files: `web/src/App.tsx`, `state/store.ts`, `lib/urlState.ts`, `api/`, `components/Cloud|Plane|Levels|Radial*.tsx`.
Original: AtomSim Phase 4 (M3/M4).
Done: `npm test && npm run build` green; `?n=3&l=1&m=-1&system=mu-h` round-trips.

### Phase 5 — Constants lab, classical ghost, force laws
Goal: vary constants, classical foil, presets + typed `V(r)` evaluator.
Files: `constants_lab.py`, `classical.py`, `numerics/force_law.py`, `numerics/expression.py`, `components/WhatIf|ForceLaw*.tsx`.
Original: AtomSim Phases 5–6.
Done: `pytest tests/test_{constants_lab,classical,force_law,free_form,expression}.py` green; e×2 + ε₀×4 changes nothing.

### Phase 6 — Screened atoms and sampling
Goal: GSZ model (15 elements), Monte-Carlo sampling (KS), plane cuts.
Files: `numerics/screening.py`, `screened_atom.py`, `sampling.py`, `plane.py`.
Original: AtomSim Phase 7.
Done: `pytest tests/test_{screening,screened_atom,sampling,plane}.py` green.

### Phase 7 — Fine structure, Dirac, Zeeman, Stark, hyperfine
Goal: perturbative FS + Dirac check, Breit-Rabi, Stark, hyperfine (21 cm).
Files: `analytic/fine_structure.py`, `dirac.py`, `zeeman.py`, `stark.py`, `hyperfine.py`.
Original: AtomSim Phase 8.
Done: `pytest tests/test_{fine_structure,dirac,zeeman,stark,hyperfine}.py` green.

### Phase 8 — Transitions and NIST spectra
Goal: dipoles, oscillator strengths, Einstein A, Wigner 3j/6j, vs vendored NIST.
Files: `analytic/oscillator.py`, `transitions.py`, `wigner.py`, `numerics/dipole.py`, `spectra.py`, `data/nist_*.json`.
Original: AtomSim Phase 9.
Done: `pytest tests/test_{oscillator,transitions,wigner,spectra}*.py` green; no network.

### Phase 9 — Thermal light and absorption
Goal: Boltzmann/Saha, Voigt, optical depth, curve of growth, absorption views.
Files: `populations.py`, `broadening.py`, `transfer.py`, `components/Absorption|CurveOfGrowth*.tsx`.
Original: AtomSim Phase 10.
Done: `pytest tests/test_{populations,broadening,transfer,absorption,server_absorption}.py` green.

### Phase 10 — Hartree-Fock core
Goal: hand-written radial HF on exponential mesh, SCF, open shells, reference checks.
Files: `numerics/hartree_fock.py`, `hf_terms.py`, `slater.py`, `hf_atom.py`, `hf_reference.py`, `data/hf_reference_energies.json`.
Original: AtomSim Phase 11.
Done: `pytest tests/test_hartree_fock.py tests/test_hf_*.py` green; Ar converges.

### Phase 11 — Counterfactual electrons, HF 3D, density comparison
Goal: exchange/Pauli off (1s^N); HF 3D views, total densities, GSZ-vs-HF axis, S/Cl.
Files: `hf_atom.py` (flags), `numerics/hartree_fock.py`, `server` HF views, `density_compare.py`, `components/WhatIfView.tsx` (part).
Original: AtomSim Phases 12–13.
Done: `pytest tests/test_{hf_exchange,hf_pauli,hf_views,total_density,density_compare,sulfur_chlorine}.py` green.

### Phase 12 — Isosurfaces
Goal: marching-tetrahedra extractor, isosurface builder + 3D view.
Files: `numerics/marching_tets.py`, `isosurface.py`, `components/IsoSurface.tsx`.
Original: AtomSim Phase 14.
Done: `pytest tests/test_{marching_tets,isosurface,server_iso}.py` green.

### Phase 13 — Server hardening, tour, copy, mobile
Goal: rate limits, schemas, thumbnails, tours with claim checks, real mobile layout.
Files: `server/ratelimit.py`, `schemas.py`, `thumbnails.py`, `jobs.py`, `tour_claims.py`, `web/src/tours/`, `components/Tour*.tsx`.
Original: AtomSim Phases 15–16.
Done: `pytest tests/test_{ratelimit,server_ratelimit,server_static,thumbnails,tour_claims}.py` green; smoke passes (101 upgrade).

### Phase 14 — Deploy and ops
Goal: two-stage Docker, Fly single-machine, setup docs, analytics, LUTs.
Files: `Dockerfile`, `fly.toml`, `docs/SETUP.md`, `docs/DEPLOY.md`, `scripts/gen_luts.py`, `web/src/lib/luts.ts`.
Original: AtomSim Phase 17.
Done: `docker build` + smoke green; `/api/health` warm; `DEPLOY.md` matches `fly.toml`.
