# Phase 0 — Foundation and provenance spine (plan)

1. Scaffold `pyproject.toml` (`src` layout, full target deps incl. explicit
   `websockets`), `environment.yml`, `ci.yml` (python job only; web/container/
   deploy arrive with their phases), `.gitignore`.
2. Copy `provenance.py`, `constants.py` from `../AtomSim` worktree (includes its
   uncommitted validation hardening); copy `numerics/mesh.py` but keep
   `display_window` as ONE docstring (the reference worktree has a stray
   closing `"""` there that breaks import — do not copy that hunk).
3. Write `tests/test_provenance.py`, `tests/test_constants.py` (adapted
   imports); write `tests/test_mesh.py` Phase-0-only — no `analytic`/`hf`
   imports, hardcoded E_1 = -0.5 Ha.
4. `pip install -e .[dev]` in `.venv`, run `pytest` + `ruff check .`, fix.
5. Record spec (what/why) + this plan (how); index in `docs/README.md`.
