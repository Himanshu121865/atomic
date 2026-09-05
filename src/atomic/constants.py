"""Fundamental constants (CODATA, via scipy) and the counterfactual-universe
hook.

The engine computes internally in Hartree atomic units; this module holds the
SI anchors and the display conversions. A FundamentalConstants instance with
altered fields IS a counterfactual universe, which is what the What-If Lab
runs on.
"""

import math
from dataclasses import dataclass

from scipy import constants as _sc

# A real-universe display anchor ONLY: in a counterfactual universe the
# conversion has to come through FundamentalConstants.hartree_energy, never
# through this.
HARTREE_EV: float = _sc.physical_constants["Hartree energy in eV"][0]

# A real-universe display anchor ONLY (same caveat as HARTREE_EV): in a
# counterfactual universe alpha comes through FundamentalConstants.alpha,
# never through this.
ALPHA: float = _sc.fine_structure

# A real-universe display anchor ONLY (same caveat): pm per bohr, for readouts.
BOHR_RADIUS_PM: float = _sc.physical_constants["Bohr radius"][0] * 1e12

# A real-universe display anchor ONLY (same caveat): fm per bohr, for nuclear radii.
BOHR_RADIUS_FM: float = _sc.physical_constants["Bohr radius"][0] * 1e15

# A real-universe display anchor ONLY (same caveat): the atomic unit of magnetic
# field (hbar / (e a0^2)), in tesla, used for the Tesla to a.u.
# conversion at the server boundary.
B0_TESLA: float = _sc.physical_constants["atomic unit of mag. flux density"][0]

# A real-universe display anchor ONLY (same caveat): the atomic unit of electric
# field (E_h / (e a0)), in volts per metre, used for the MV/m to a.u.
# conversion at that same boundary.
E0_V_PER_M: float = _sc.physical_constants["atomic unit of electric field"][0]


@dataclass(frozen=True)
class FundamentalConstants:
    hbar: float  # J s
    e: float     # C
    m_e: float   # kg
    eps0: float  # F/m
    c: float     # m/s

    def __post_init__(self) -> None:
        for name in ("hbar", "e", "m_e", "eps0", "c"):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"{name} must be a real number, got {value!r}")
            v = float(value)
            if not math.isfinite(v) or v <= 0.0:
                raise ValueError(
                    f"{name} must be finite and positive, got {value!r}"
                )
            object.__setattr__(self, name, v)

    @classmethod
    def codata(cls) -> "FundamentalConstants":
        return cls(
            hbar=_sc.hbar,
            e=_sc.elementary_charge,
            m_e=_sc.electron_mass,
            eps0=_sc.epsilon_0,
            c=_sc.speed_of_light,
        )

    @property
    def alpha(self) -> float:
        """Fine-structure constant e^2 / (4 pi eps0 hbar c), dimensionless."""
        return self.e**2 / (4 * math.pi * self.eps0 * self.hbar * self.c)

    @property
    def bohr_radius(self) -> float:
        """a0 = 4 pi eps0 hbar^2 / (m_e e^2), in metres."""
        return 4 * math.pi * self.eps0 * self.hbar**2 / (self.m_e * self.e**2)

    @property
    def hartree_energy(self) -> float:
        """E_h = hbar^2 / (m_e a0^2), in joules."""
        return self.hbar**2 / (self.m_e * self.bohr_radius**2)

    # --- counterfactual-safe display conversions ---------------------------
    # The module-level anchors above are the real universe, for display at the
    # server boundary only. Inside counterfactual physics, convert through the
    # instance that defines the universe instead, so an altered e/eps0/m_e
    # moves every readout consistently.

    @property
    def hartree_ev(self) -> float:
        """Hartree energy in eV, for this universe (E_h / e)."""
        return self.hartree_energy / self.e

    @property
    def bohr_pm(self) -> float:
        """Bohr radius in picometres, for this universe."""
        return self.bohr_radius * 1e12

    @property
    def bohr_fm(self) -> float:
        """Bohr radius in femtometres, for this universe."""
        return self.bohr_radius * 1e15

    @property
    def b0_tesla(self) -> float:
        """Atomic unit of magnetic flux density hbar/(e a0^2), in tesla."""
        return self.hbar / (self.e * self.bohr_radius**2)

    @property
    def e0_v_per_m(self) -> float:
        """Atomic unit of electric field E_h/(e a0), in V/m."""
        return self.hartree_energy / (self.e * self.bohr_radius)
