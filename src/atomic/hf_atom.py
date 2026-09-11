
import dataclasses
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from scipy.interpolate import CubicSpline
from scipy.linalg import eigh_tridiagonal

from atomic.analytic.angular import spherical_harmonic
from atomic.analytic.dirac import dirac_energy
from atomic.analytic.hydrogen import energy as hydrogen_energy
from atomic.analytic.wavefunction import WavefunctionValues
from atomic.atoms import (
    Configuration,
    aufbau_configuration,
    is_ground,
    is_single_term,
    open_subshells,
    total_electrons,
    validate_config,
)
from atomic.numerics.hartree_fock import (
    HFConvergenceError,
    SCFSolution,
    kinetic_and_potential,
    orbital_energy,
    scf,
    total_energy_direct,
    total_energy_from_orbitals,
)
from atomic.numerics.hf_terms import Subshell
from atomic.numerics.mesh import RadialMesh, display_window, mesh_for_atom_at_step
from atomic.numerics.screening import gsz_parameters, screened_potential
from atomic.provenance import Fidelity, Field, Provenance, Quantity

__all__ = [
    "HFOrbital",
    "HFResult",
    "evaluate_hf_state",
    "hf_mean_radius",
    "hf_mesh",
    "hf_radial",
    "hf_total_radial_density",
    "hf_valence_ionization_energy",
    "solve_hartree_fock",
]

_HF_EVAL_POINTS = 4096

_ROUTE_AGREEMENT = 1e-6

_TOTAL_ENERGY_METHOD = (
    "a self-consistent restricted Hartree-Fock, average of configuration, "
    "by matrix-free preconditioned LOBPCG on an exponential radial mesh"
)
_TOTAL_ENERGY_ASSUMPTIONS = (
    "no electron correlation is included; the method is variational, so "
    "E_HF >= E_exact (non-relativistic, infinite nuclear mass)",
    "uses an infinite nuclear mass (mu_ratio = 1)",
)
_OPEN_SHELL_ASSUMPTION = (
    "restricted: one radial function per subshell shared by both spins, so the "
    "core cannot spin-polarize around an unpaired electron; that omission is "
    "far smaller than the correlation energy named above"
)
_MULTI_TERM_ASSUMPTION = (
    "an average of configuration: one energy per configuration, not per term, "
    "so this energy lies among the terms the configuration splits into rather "
    "than on the lowest of them"
)

_TOTAL_ENERGY_REFINEMENT = (
    "configuration interaction or many-body perturbation theory would recover "
    "the missing correlation energy"
)

_ORBITAL_NOT_OBSERVABLE = (
    "this is one orbital of a self-consistent field, and an orbital is not an "
    "observable: the total density of this atom is exactly spherical, so the "
    "shape drawn here is a basis choice rather than a photograph"
)
_RELATIVITY_WORTH_STATING_Z = 9
_DIAGNOSTIC_METHOD = (
    "a property of the converged solution, not a claim about the atom"
)

_MESH_STEP = 0.01

_MESH_FLOOR_RELATIVE = 4.0e-6


@dataclass(frozen=True)
class HFOrbital:
    n: int
    l: int
    occupancy: int
    energy: Quantity
    P: Field


@dataclass(frozen=True)
class HFResult:
    key: str
    z: int
    n_electrons: int
    config: Configuration
    is_ground: bool
    orbitals: tuple[HFOrbital, ...]
    total_energy: Quantity
    kinetic: Quantity
    potential: Quantity
    virial_ratio: Quantity
    iterations: int
    coarse_iterations: int
    residual_history: tuple[float, ...]
    converged: bool
    provenance: Provenance


def hf_mesh(z: int, n_electrons: int, n_top: int, refinement: int = 1) -> RadialMesh:
    z_net = max(z - n_electrons + 1, 1)
    r_max = min(60.0, 12.0 * (n_top + 1) ** 2 / z_net)
    return mesh_for_atom_at_step(z, r_max, _MESH_STEP / refinement)


def _start_potential(z: int, n_electrons: int):
    if n_electrons == 1:
        return screened_potential(z, n_electrons)
    try:
        gsz_parameters(z, n_electrons)
    except ValueError:
        return lambda rr: -float(z) / np.asarray(rr, dtype=float)
    return screened_potential(z, n_electrons)


def _guess_from_central_field(
    z: int, n_electrons: int, config: Configuration, mesh: RadialMesh
) -> tuple[Subshell, ...]:
    v = np.asarray(_start_potential(z, n_electrons)(mesh.r), dtype=float)
    by_l: dict[int, np.ndarray] = {}
    for (n, l), _ in config:
        needed = n - l
        if l not in by_l or by_l[l].shape[0] < needed:
            diag, offdiag = mesh.hamiltonian_bands(v, l)
            vectors = eigh_tridiagonal(
                diag, offdiag, select="i", select_range=(0, needed - 1)
            )[1]
            by_l[l] = mesh.to_p(vectors.T)
    return tuple(
        Subshell(n=n, l=l, q=q, p=mesh.normalized(by_l[l][n - l - 1]))
        for (n, l), q in config
    )


def _refine(
    coarse: SCFSolution, coarse_mesh: RadialMesh, fine: RadialMesh
) -> tuple[Subshell, ...]:
    knots = np.concatenate(([0.0], coarse_mesh.r, [coarse_mesh.outer_wall]))
    return tuple(
        Subshell(
            n=a.n, l=a.l, q=a.q,
            p=fine.normalized(
                CubicSpline(knots, np.concatenate(([0.0], a.p, [0.0])))(fine.r)
            ),
        )
        for a in coarse.subshells
    )


def _relativistic_scale(z: int) -> float:
    schrodinger = hydrogen_energy(1, Z=z).value
    relativistic = dirac_energy(1, 0.5, Z=z).value
    return abs(relativistic - schrodinger) / abs(schrodinger)


def _energy_assumptions(config: Configuration, z: int) -> tuple[str, ...]:
    out = list(_TOTAL_ENERGY_ASSUMPTIONS)
    if z >= _RELATIVITY_WORTH_STATING_Z:
        out.append(
            f"the model neglects relativity, which at Z = {z} shifts the hydrogenic 1s "
            f"by {100 * _relativistic_scale(z):.2f}% of its energy; that is the "
            f"scale of what is missing here, not a correction to apply"
        )
    if open_subshells(config):
        out.append(_OPEN_SHELL_ASSUMPTION)
    if not is_single_term(config):
        out.append(_MULTI_TERM_ASSUMPTION)
    return tuple(out)


def _solve_on_grid(
    z: int,
    n_electrons: int,
    config: Configuration,
    mesh: RadialMesh,
    start: tuple[Subshell, ...] | None,
) -> tuple[SCFSolution, tuple[float, ...], float]:
    if start is None:
        start = _guess_from_central_field(z, n_electrons, config, mesh)

    solution = scf(
        z, start, lambda rr: -z / rr, mesh, tol=1e-9 * max(1, z**2),
    )
    energies = tuple(
        orbital_energy(solution.subshells, i, z, mesh)
        for i in range(len(solution.subshells))
    )
    return solution, energies, total_energy_direct(z, solution.subshells, mesh)


@lru_cache(maxsize=8)
def solve_hartree_fock(
    z: int,
    n_electrons: int,
    config: Configuration,
) -> HFResult:
    if z < 1:
        raise ValueError(f"Z must be >= 1, got {z}")
    if not 1 <= n_electrons <= z + 1:
        raise ValueError(f"N must be in [1, Z+1], got {n_electrons} (Z={z})")
    validate_config(config)
    if total_electrons(config) != n_electrons:
        raise ValueError(
            f"this configuration holds {total_electrons(config)} electrons, "
            f"not the {n_electrons} requested"
        )

    n_top = max(n for (n, _), _ in config)
    coarse_mesh = hf_mesh(z, n_electrons, n_top, refinement=1)
    mesh = hf_mesh(z, n_electrons, n_top, refinement=2)
    coarse, coarse_energies, e_coarse = _solve_on_grid(
        z, n_electrons, config, coarse_mesh, start=None
    )
    solution, energies, e_direct = _solve_on_grid(
        z, n_electrons, config, mesh,
        start=_refine(coarse, coarse_mesh, mesh),
    )

    e_identity = total_energy_from_orbitals(solution.subshells, energies, z, mesh)
    if abs(e_direct - e_identity) > _ROUTE_AGREEMENT:
        raise HFConvergenceError(
            f"the two total-energy routes disagree by "
            f"{abs(e_direct - e_identity):.3e} hartree for Z={z}, N={n_electrons}; "
            f"that is a coding error, not a discretization one"
        )

    kinetic, potential = kinetic_and_potential(z, solution.subshells, mesh)

    assumptions = _energy_assumptions(config, z)
    method, refinement = _TOTAL_ENERGY_METHOD, _TOTAL_ENERGY_REFINEMENT
    energy_prov = Provenance(
        fidelity=Fidelity.APPROXIMATION,
        method=method,
        assumptions=assumptions,
        error_estimate=(
            abs(e_direct - e_coarse) + _MESH_FLOOR_RELATIVE * abs(e_direct)
        ),
        refinement=refinement,
    )
    diagnostic_prov = Provenance(
        fidelity=Fidelity.NUMERICAL,
        method=_DIAGNOSTIC_METHOD,
        assumptions=(
            f"converged in {coarse.iterations} SCF iterations on the coarse "
            f"mesh and {solution.iterations} on the fine one, which starts from "
            f"the coarse solution rather than from a central field",
        ),
    )
    shape_prov = Provenance(
        fidelity=Fidelity.APPROXIMATION,
        method=f"{method}; the radial amplitude sampled on the solver mesh",
        assumptions=assumptions,
        refinement=refinement,
    )

    orbitals = tuple(
        HFOrbital(
            n=a.n, l=a.l, occupancy=a.q,
            energy=Quantity(
                fine, "hartree", f"eps_{a.n}{a.l}",
                dataclasses.replace(
                    energy_prov,
                    error_estimate=(
                        abs(fine - crude) + _MESH_FLOOR_RELATIVE * abs(fine)
                    ),
                ),
            ),
            P=Field(
                values=a.p, grid=mesh.r, unit="bohr^-1/2", grid_unit="bohr",
                label=f"P_{a.n}{a.l}", provenance=shape_prov,
            ),
        )
        for a, fine, crude in zip(
            solution.subshells, energies, coarse_energies, strict=True
        )
    )

    return HFResult(
        key=f"z{z}n{n_electrons}",
        z=z,
        n_electrons=n_electrons,
        config=config,
        is_ground=is_ground(config),
        orbitals=orbitals,
        total_energy=Quantity(e_direct, "hartree", "E_total", energy_prov),
        kinetic=Quantity(kinetic, "hartree", "T", diagnostic_prov),
        potential=Quantity(potential, "hartree", "V", diagnostic_prov),
        virial_ratio=Quantity(
            -potential / kinetic, "dimensionless", "-V/T", diagnostic_prov
        ),
        iterations=solution.iterations,
        coarse_iterations=coarse.iterations,
        residual_history=solution.residual_history,
        converged=True,
        provenance=energy_prov,
    )


def hf_valence_ionization_energy(result: HFResult) -> Quantity:
    occupied = [o for o in result.orbitals if o.occupancy > 0]
    if not occupied:
        raise ValueError("no occupied orbitals")
    valence = max(occupied, key=lambda o: o.energy.value)
    base = valence.energy.provenance
    prov = dataclasses.replace(
        base,
        method=f"{base.method}; the ionization energy is -epsilon_valence (Koopmans)",
        assumptions=base.assumptions
        + (
            "Koopmans: the N-1 remaining electrons are assumed not to relax, "
            "which overestimates the ionization energy (0.39 eV for helium, less "
            "for atoms whose valence electron sits outside a closed core)",
        ),
        refinement=(
            "a Delta-SCF ionization energy, E(ion) - E(atom), would relax the ion "
            "and remove the Koopmans error, leaving only the correlation one"
        ),
    )
    return Quantity(-valence.energy.value, "hartree", "IE_valence", prov)


def hf_mean_radius(result: HFResult) -> Quantity:
    n_top = max(n for (n, _), _ in result.config)
    mesh = hf_mesh(result.z, result.n_electrons, n_top, refinement=2)
    weighted = 0.0
    for orbital in result.orbitals:
        p2 = orbital.P.values**2
        weighted += orbital.occupancy * mesh.integrate(p2 * mesh.r) / mesh.integrate(p2)
    base = result.total_energy.provenance
    return Quantity(
        weighted / result.n_electrons,
        "bohr",
        "<r>",
        Provenance(
            fidelity=base.fidelity,
            method=(
                f"{base.method}; <r> = sum_a q_a integral P_a^2 r dr / N "
                f"on the solver mesh"
            ),
            assumptions=base.assumptions,
            refinement=base.refinement,
        ),
    )


_TOTAL_DENSITY_IS_OBSERVABLE = (
    "this one IS an observable: the total electron density, summed over every "
    "occupied subshell, is what an X-ray diffraction experiment measures. Its "
    "peaks are the shells, and the orbitals plotted elsewhere are the basis it "
    "was assembled from rather than things anyone can measure one at a time"
)


def hf_total_radial_density(
    z: int,
    n_electrons: int,
    *,
    config: Configuration | None = None,
    points: int = 400,
) -> Field:
    cfg = aufbau_configuration(n_electrons) if config is None else config
    result = solve_hartree_fock(z, n_electrons, cfg)

    solver_r = result.orbitals[0].P.grid
    grid = np.geomspace(solver_r[0], solver_r[-1], points)
    values = np.zeros_like(grid)
    for orbital in result.orbitals:
        values += (
            orbital.occupancy
            * np.interp(grid, orbital.P.grid, orbital.P.values) ** 2
        )

    residual = abs(float(np.trapezoid(values, grid)) - float(n_electrons))

    base = result.total_energy.provenance
    return Field(
        values=values,
        grid=grid,
        unit="electrons/bohr",
        grid_unit="bohr",
        label=f"D(r) = sum_a q_a P_a(r)^2 (N = {n_electrons})",
        provenance=Provenance(
            fidelity=base.fidelity,
            method=(
                f"{base.method}; the total radial density summed over the "
                f"occupied subshells and resampled onto {points} "
                f"logarithmically spaced points (a uniform grid steps over the 1s)"
            ),
            assumptions=base.assumptions + (_TOTAL_DENSITY_IS_OBSERVABLE,),
            error_estimate=residual,
            refinement=base.refinement,
        ),
    )


def _occupied_orbital(
    z: int,
    n_electrons: int,
    n: int,
    l: int,
    config: Configuration | None = None,
) -> HFOrbital:
    if n <= l:
        raise ValueError(f"n must be > l, got n={n}, l={l}")
    cfg = aufbau_configuration(n_electrons) if config is None else config
    result = solve_hartree_fock(z, n_electrons, cfg)
    for orbital in result.orbitals:
        if (orbital.n, orbital.l) == (n, l):
            return orbital
    held = ", ".join(f"{o.n}{'spdf'[o.l]}" for o in result.orbitals)
    raise ValueError(
        f"subshell {n}{'spdf'[l]} is not occupied in Z={z}, N={n_electrons} "
        f"(which holds {held}); one Fock operator is built per occupied "
        "subshell, so there is no operator for an empty one"
    )


def hf_radial(
    z: int,
    n_electrons: int,
    n: int,
    l: int,
    points: int = 400,
    *,
    config: Configuration | None = None,
) -> tuple[Field, Field]:
    orbital = _occupied_orbital(z, n_electrons, n, l, config=config)
    solver_r = orbital.P.grid
    r_out = display_window(solver_r, orbital.P.values**2)
    grid = np.linspace(solver_r[0], r_out, points)
    values = np.interp(grid, solver_r, orbital.P.values / solver_r)
    prov = dataclasses.replace(
        orbital.P.provenance,
        method=(
            f"{orbital.P.provenance.method}; R_nl = P/r resampled uniformly"
            f" to r={grid[-1]:.3g} bohr, windowed from a mesh reaching"
            f" {solver_r[-1]:.3g}"
        ),
        assumptions=orbital.P.provenance.assumptions + (_ORBITAL_NOT_OBSERVABLE,),
    )
    r_field = Field(
        values=values, grid=grid, unit="bohr^-3/2", grid_unit="bohr",
        label=f"R_{n},{l}(r)", provenance=prov,
    )
    p_field = Field(
        values=grid**2 * values**2, grid=grid, unit="bohr^-1", grid_unit="bohr",
        label=f"P_{n},{l}(r) = r^2 R^2", provenance=prov,
    )
    return r_field, p_field


def evaluate_hf_state(
    z: int,
    n_electrons: int,
    n: int,
    l: int,
    m: int,
    positions: np.ndarray,
    *,
    basis: str = "complex",
    config: Configuration | None = None,
) -> WavefunctionValues:
    pos = np.asarray(positions, dtype=float)
    if pos.ndim != 2 or pos.shape[1] != 3:
        raise ValueError(f"positions must have shape (N, 3), got {pos.shape}")

    r = np.linalg.norm(pos, axis=1)
    safe_r = np.where(r > 0.0, r, 1.0)
    theta = np.arccos(np.clip(pos[:, 2] / safe_r, -1.0, 1.0))
    theta = np.where(r > 0.0, theta, 0.0)
    phi = np.arctan2(pos[:, 1], pos[:, 0])

    r_field, _ = hf_radial(
        z, n_electrons, n, l, points=_HF_EVAL_POINTS, config=config,
    )
    R = np.interp(r, r_field.grid, r_field.values, left=r_field.values[0], right=0.0)
    angular = spherical_harmonic(l, m, theta, phi, basis=basis)

    base = r_field.provenance
    prov = Provenance(
        fidelity=base.fidelity,
        method=(
            f"psi_nlm built as Hartree-Fock R_nl (P/r) x "
            f"{angular.provenance.method}; {base.method}"
        ),
        assumptions=base.assumptions
        + angular.provenance.assumptions
        + ("values are in bohr^-3/2 at Cartesian positions in bohr",),
        error_estimate=base.error_estimate,
    )
    return WavefunctionValues(
        values=R * angular.values, positions=pos, n=n, l=l, m=m, Z=z, mu_ratio=1.0,
        basis=basis, provenance=prov,
    )
