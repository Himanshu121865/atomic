"""Radial meshes and their discretizations (NUMERICAL).

A uniform grid wastes ~99% of its points in vacuum at high Z. The exponential
mesh r = r_min e^(i delta) keeps constant RELATIVE resolution with a few
thousand points instead of ~72000 for argon.

Each mesh type carries the kinetic operator its own change of variables
produces. On the exponential mesh, x = ln r with P = sqrt(r) Q gives:

    diag      V(r) + (2l+1)^2 / 8r^2 + 1 / delta^2 r^2
    offdiag   -1 / 2 delta^2 r_i r_i+1

The eigenproblem runs on S = sqrt(delta J) P, so the plain Euclidean dot
product on S is the physical integral P^2 dr.

Inner wall: an exponential mesh cannot reach the origin, so the ghost node
below r_min is folded in (S_-1 = S_0 exp(-(l+3/2) delta)), making the wall
error quadratic in r_min. Two errors oppose: wall truncation ~ 2 (Z r_min)^2
and conditioning noise ~ eps / (delta^2 r_min^2 |E|), minimized at
Z r_min ~ 1.1e-3 with a floor near 2.4e-6 relative, independent of Z.
`for_atom` places r_min at 1e-3/Z. Never Richardson-extrapolate past the
optimum: the residual there is conditioning noise, not a smooth power.

Hartree atomic units throughout. Plain arrays in/out: quadrature, not physics,
so provenance belongs to the caller (same exemption as slater.py).
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

__all__ = [
    "RadialMesh",
    "display_window",
    "exponential_mesh",
    "mesh_for_atom",
    "mesh_for_atom_at_step",
    "uniform_mesh",
]

# The Z r_min where wall truncation crosses conditioning noise.
_OPTIMAL_SCALED_INNER_RADIUS = 1.0e-3


@dataclass(frozen=True)
class RadialMesh:
    """A radial grid plus the coordinate its quadrature is uniform in.

    `jacobian` is dr/dx per node; `kinetic_*` is the l-independent part of
    -1/2 d2/dr2 in the S representation. `inner_wall_coupling` /
    `inner_ghost_ratio` describe the ghost node below r[0] (ratio 0 = wall
    exactly on the origin, correction vanishes identically).
    """

    r: np.ndarray
    jacobian: np.ndarray
    step: float
    kinetic_diag: np.ndarray
    kinetic_offdiag: np.ndarray
    inner_wall_coupling: float
    inner_ghost_ratio: float

    def __post_init__(self) -> None:
        if self.r.ndim != 1 or self.r.size < 3:
            raise ValueError(f"mesh must be 1-D with at least 3 points, got {self.r.shape}")
        if self.r[0] <= 0.0:
            raise ValueError(
                f"the mesh must start strictly above zero, got "
                f"r[0]={float(self.r[0])!r}; at r = 0 the centrifugal term and the "
                "pair-potential outer integrand are both infinite"
            )
        if not np.all(np.diff(self.r) > 0.0):
            raise ValueError("mesh must be strictly increasing")
        if self.jacobian.shape != self.r.shape:
            raise ValueError("jacobian must have one entry per node")
        if not np.all(np.isfinite(self.jacobian)):
            raise ValueError("jacobian must be finite (no NaN or inf)")
        if not np.all(self.jacobian > 0.0):
            raise ValueError("jacobian (dr/dx) must be strictly positive")
        if self.kinetic_diag.shape != self.r.shape:
            raise ValueError("kinetic diagonal must have one entry per node")
        if not np.all(np.isfinite(self.kinetic_diag)):
            raise ValueError("kinetic diagonal must be finite (no NaN or inf)")
        if self.kinetic_offdiag.shape != (self.r.size - 1,):
            raise ValueError(
                f"kinetic off-diagonal must have one entry per interior "
                f"interval, so {self.r.size - 1}, got {self.kinetic_offdiag.shape}"
            )
        if not np.all(np.isfinite(self.kinetic_offdiag)):
            raise ValueError("kinetic off-diagonal must be finite (no NaN or inf)")
        if self.step <= 0.0:
            raise ValueError(f"mesh step must be positive, got {self.step!r}")
        if not 0.0 <= self.inner_ghost_ratio < 1.0:
            raise ValueError(
                f"inner ghost node must sit below r[0], got a ratio of "
                f"{self.inner_ghost_ratio!r}"
            )

    @property
    def points(self) -> int:
        return int(self.r.size)

    @property
    def outer_wall(self) -> float:
        """Outer Dirichlet wall: one step past r[-1], not r[-1] itself."""
        return float(self.r[-1] + self.step * self.jacobian[-1])

    def integrate(self, f: np.ndarray) -> float:
        """integral f(r) dr as integral f J dx by the trapezoid rule in x."""
        arr = np.asarray(f, dtype=float)
        if arr.shape != self.r.shape:
            raise ValueError(
                f"integrand must be sampled on this mesh "
                f"(got {arr.shape}, mesh has {self.r.shape})"
            )
        return float(np.trapezoid(arr * self.jacobian) * self.step)

    def cumulative(self, f: np.ndarray) -> np.ndarray:
        """The integral from the inner wall out to r of f ds, same length as r."""
        arr = np.asarray(f, dtype=float)
        if arr.shape != self.r.shape:
            raise ValueError(
                f"integrand must be sampled on this mesh "
                f"(got {arr.shape}, mesh has {self.r.shape})"
            )
        y = arr * self.jacobian
        increments = 0.5 * (y[..., 1:] + y[..., :-1]) * self.step
        out = np.empty_like(y)
        out[..., 0] = 0.0
        np.cumsum(increments, axis=-1, out=out[..., 1:])
        return out

    def to_s(self, p: np.ndarray) -> np.ndarray:
        """P -> S = sqrt(delta J) P, the variable the eigenproblem is solved in."""
        arr = np.asarray(p, dtype=float)
        if arr.shape != self.r.shape:
            raise ValueError(
                f"orbital must be sampled on this mesh "
                f"(got {arr.shape}, mesh has {self.r.shape})"
            )
        return arr * np.sqrt(self.step * self.jacobian)

    def to_p(self, s: np.ndarray) -> np.ndarray:
        """S -> P, the physical radial function r R(r)."""
        arr = np.asarray(s, dtype=float)
        if arr.shape != self.r.shape:
            raise ValueError(
                f"orbital must be sampled on this mesh "
                f"(got {arr.shape}, mesh has {self.r.shape})"
            )
        return arr / np.sqrt(self.step * self.jacobian)

    def normalized(self, p: np.ndarray) -> np.ndarray:
        """P, scaled so that integral P^2 dr = 1 in this mesh's own quadrature."""
        arr = np.asarray(p, dtype=float)
        if arr.shape != self.r.shape:
            raise ValueError(
                f"orbital must be sampled on this mesh "
                f"(got {arr.shape}, mesh has {self.r.shape})"
            )
        return arr / np.sqrt(self.integrate(arr**2))

    def hamiltonian_bands(
        self, v_local: np.ndarray, l: int
    ) -> tuple[np.ndarray, np.ndarray]:
        """The diagonal and off-diagonal of the local Hamiltonian, in S."""
        if l < 0:
            raise ValueError(f"orbital quantum number l must be >= 0, got {l}")
        v = np.asarray(v_local, dtype=float)
        if v.shape != self.r.shape:
            raise ValueError("the potential must be sampled on this mesh")

        diag = self.kinetic_diag + l * (l + 1) * 0.5 / self.r**2 + v
        # P ~ r^(l+1) near the origin, so S ~ r^(l+3/2). Folding the ghost node
        # in is what makes the wall error quadratic in r_min instead of linear.
        diag = diag.copy()
        diag[0] += self.inner_wall_coupling * self.inner_ghost_ratio ** (l + 1.5)
        # Copy the off-diagonal: it is mesh-owned state, and a caller doing
        # in-place work on the returned bands must never mutate the mesh.
        return diag, self.kinetic_offdiag.copy()


def uniform_mesh(r_max: float, points: int) -> RadialMesh:
    """r = h, 2h, ... with h = r_max / (points + 1); the wall lands on r = 0."""
    if r_max <= 0.0:
        raise ValueError(f"box radius must be positive, got {r_max!r}")
    if points < 3:
        raise ValueError(f"mesh needs at least 3 points, got {points}")
    h = r_max / (points + 1)
    return RadialMesh(
        r=h * np.arange(1, points + 1),
        jacobian=np.ones(points),
        step=h,
        kinetic_diag=np.full(points, 1.0 / h**2),
        kinetic_offdiag=np.full(points - 1, -0.5 / h**2),
        inner_wall_coupling=-0.5 / h**2,
        inner_ghost_ratio=0.0,  # here the wall IS the origin, and P there is exactly 0
    )


def exponential_mesh(r_min: float, r_max: float, points: int) -> RadialMesh:
    """r = r_min e^(i delta), spaced geometrically from r_min to r_max."""
    if r_min <= 0.0:
        raise ValueError(
            f"the inner radius must be strictly above zero, got {r_min!r}; an "
            "exponential mesh cannot reach the origin, it only approaches it"
        )
    if r_max <= r_min:
        raise ValueError(f"box radius {r_max!r} must exceed inner radius {r_min!r}")
    if points < 3:
        raise ValueError(f"mesh needs at least 3 points, got {points}")

    delta = float(np.log(r_max / r_min) / (points - 1))
    r = r_min * np.exp(delta * np.arange(points))
    ghost = float(np.exp(-delta))

    # The 1/8 is not the centrifugal term. It is what P = sqrt(r) Q generates on
    # its own, and together with the l(l+1)/2 added in hamiltonian_bands it
    # makes the (2l+1)^2/8 of the exponential-mesh literature.
    return RadialMesh(
        r=r,
        jacobian=r.copy(),
        step=delta,
        kinetic_diag=(1.0 / delta**2 + 0.125) / r**2,
        kinetic_offdiag=-0.5 / (delta**2 * r[:-1] * r[1:]),
        inner_wall_coupling=-0.5 / (delta**2 * ghost * r[0] ** 2),
        inner_ghost_ratio=ghost,
    )


def mesh_for_atom(z: int, r_max: float, points: int) -> RadialMesh:
    """The exponential mesh at the r_min minimizing total error (1e-3 / Z)."""
    if z < 1:
        raise ValueError(f"Z must be >= 1, got {z}")
    return exponential_mesh(_OPTIMAL_SCALED_INNER_RADIUS / z, r_max, points)


def mesh_for_atom_at_step(z: int, r_max: float, step: float) -> RadialMesh:
    """`mesh_for_atom`, sized by step instead of point count.

    Floored, so the delivered step is never finer than asked; halving `step`
    always refines, with endpoints fixed across the pair.
    """
    if z < 1:
        raise ValueError(f"Z must be >= 1, got {z}")
    if step <= 0.0:
        raise ValueError(f"step must be positive, got {step!r}")
    r_min = _OPTIMAL_SCALED_INNER_RADIUS / z
    if r_max <= r_min:
        raise ValueError(f"box radius {r_max!r} must exceed inner radius {r_min!r}")
    points = int(np.log(r_max / r_min) / step) + 1
    return exponential_mesh(r_min, r_max, points)


def display_window(
    r: NDArray[np.float64],
    density: NDArray[np.float64],
    floor: float = 1e-4,
    margin: float = 1.25,
) -> float:
    """Outer radius worth drawing for a curve solved on a much larger box.

    Presentational only (VISUAL_LIBERTY): decides which samples exist for
    display, never an energy. The caller ships this radius as the field's own
    `grid` so the axis stays honest. `floor` keeps a decade more tail than any
    display trims (1e-4 vs the frontend's 1e-3).
    """
    if r.size == 0:
        return 0.0
    peak = float(np.max(density)) if density.size else 0.0
    if not np.isfinite(peak) or peak <= 0.0:
        # Nothing to window against, so the caller's box is as good a guess as any.
        return float(r[-1])
    above = np.nonzero(density > peak * floor)[0]
    if above.size == 0:
        return float(r[-1])
    outer = float(r[above[-1]]) * margin
    peak_r = float(r[int(np.argmax(density))])
    return float(min(max(outer, peak_r * 2.0), r[-1]))
