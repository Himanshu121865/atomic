# Phase 0 — Foundation and provenance spine (spec)

## What and why
Before any physics, the repo needs a spine that makes lying about physics a
type error: every boundary value is a `Quantity`/`Field` carrying `Provenance`
with one of five tiers (`EXACT`/`NUMERICAL`/`APPROXIMATION`/`COUNTERFACTUAL`/
`VISUAL_LIBERTY`). Constants come from CODATA via scipy, with a
counterfactual hook (`FundamentalConstants` instance) for the Phase 5 lab.
Meshes own their discretization (uniform + exponential with ghost-corrected
inner wall) and quadrature. CI gates on `ruff check` + `pytest`.

## Deliberately neglected
No energies, no orbitals, no server, no web. `display_window` is presentational
(`VISUAL_LIBERTY`) and decides which samples get drawn, never an energy.

## Validation
`test_provenance` (tiers, immutability, `Field` shapes), `test_constants`
(CODATA agreement, counterfactual rescaling), `test_mesh` (guards, quadrature,
bands, ghost-correction factor, hardcoded 1s = -0.5 Ha; Phase 2 replaces the
hardcode with the analytic module).
