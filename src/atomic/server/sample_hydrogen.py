import dataclasses

import numpy as np
from scipy.special import lpmv

from atomic.analytic.hydrogen import radial_wavefunction, validate_quantum_numbers
from atomic.analytic.wavefunction import WavefunctionValues, evaluate_state
from atomic.provenance import Fidelity, Provenance


@dataclasses.dataclass(frozen=True)
class SampleCloud:
    positions: np.ndarray
    n: int
    l: int
    m: int
    basis: str
    provenance: Provenance


@dataclasses.dataclass(frozen=True)
class SampleJobResult:
    cloud: SampleCloud
    psi: WavefunctionValues


def _invert_cdf(xs: np.ndarray, pdf: np.ndarray, u: np.ndarray) -> np.ndarray:
    cdf = np.cumsum(0.5 * (pdf[1:] + pdf[:-1]) * np.diff(xs))
    cdf = np.concatenate(([0.0], cdf))
    total = cdf[-1]
    if not np.isfinite(total) or total <= 0.0:
        raise ValueError("sampling density integrates to zero")
    return np.interp(u / total, cdf, xs)


def sample_hydrogen(
    n: int,
    l: int,
    m: int,
    count: int,
    Z: int,
    mu_ratio: float,
    seed: int,
    basis: str,
    progress=None,
) -> SampleJobResult:
    validate_quantum_numbers(n, l)
    if abs(m) > l:
        raise ValueError(f"|m| must be <= l, got m={m}, l={l}")
    if basis not in ("complex", "real"):
        raise ValueError(f"basis must be 'complex' or 'real', got {basis!r}")
    if count < 1:
        raise ValueError(f"count must be >= 1, got {count}")
    rng = np.random.default_rng(seed)
    report = progress if progress is not None else (lambda f: None)

    kappa = Z * mu_ratio
    r_max = max(60.0, 80.0 * n * n / kappa)
    rg = np.linspace(0.0, r_max, 20000)
    u = rg * radial_wavefunction(n, l, rg, Z=Z, mu_ratio=mu_ratio).values
    r = _invert_cdf(rg, u**2, rng.random(count))
    report(0.3)

    th = np.linspace(0.0, np.pi, 4096)
    pm = lpmv(abs(m), l, np.cos(th))
    theta = _invert_cdf(th, pm**2 * np.sin(th), rng.random(count))
    report(0.5)

    if basis == "complex" or m == 0:
        phi = rng.random(count) * 2.0 * np.pi
    else:
        ph = np.linspace(0.0, 2.0 * np.pi, 4096)
        marginal = np.cos(abs(m) * ph) ** 2 if m > 0 else np.sin(abs(m) * ph) ** 2
        phi = _invert_cdf(ph, marginal, rng.random(count))
    report(0.7)

    positions = np.stack(
        [
            r * np.sin(theta) * np.cos(phi),
            r * np.sin(theta) * np.sin(phi),
            r * np.cos(theta),
        ],
        axis=1,
    ).astype(np.float64)
    psi = evaluate_state(n, l, m, positions, Z=Z, mu_ratio=mu_ratio, basis=basis)
    report(0.9)
    provenance = Provenance(
        fidelity=Fidelity.NUMERICAL,
        method=(
            f"inverse-CDF Monte-Carlo of |psi_{n},{l},{m}|^2 "
            f"(radial x theta x phi, N={count}, seed={seed})"
        ),
        assumptions=(
            "radial, polar and azimuthal coordinates sampled independently "
            "from their exact marginals on finite grids",
            "N finite: point density carries 1/sqrt(N) sampling noise",
        ),
        refinement="raise count; replaced by the full sampler in Phase 6",
    )
    cloud = SampleCloud(
        positions=positions.astype(np.float32),
        n=n, l=l, m=m, basis=basis,
        provenance=provenance,
    )
    report(1.0)
    return SampleJobResult(cloud=cloud, psi=psi)
