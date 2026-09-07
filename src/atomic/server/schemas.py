import dataclasses
from typing import Literal

from pydantic import BaseModel

from atomic.constants import BOHR_RADIUS_FM
from atomic.provenance import Field, Provenance, Quantity
from atomic.systems import System

FidelityName = Literal[
    "exact", "numerical", "approximation", "counterfactual", "visual_liberty"
]


class ProvenanceModel(BaseModel):
    fidelity: FidelityName
    method: str
    assumptions: list[str]
    error_estimate: float | None
    refinement: str | None

    @classmethod
    def from_provenance(cls, p: Provenance) -> "ProvenanceModel":
        return cls(
            fidelity=p.fidelity.value,
            method=p.method,
            assumptions=list(p.assumptions),
            error_estimate=p.error_estimate,
            refinement=p.refinement,
        )


class ChannelModel(BaseModel):
    name: str
    dtype: str
    unit: str
    provenance: ProvenanceModel


class QuantityModel(BaseModel):
    value: float
    unit: str
    label: str
    provenance: ProvenanceModel

    @classmethod
    def from_quantity(cls, q: Quantity) -> "QuantityModel":
        return cls(
            value=q.value,
            unit=q.unit,
            label=q.label,
            provenance=ProvenanceModel.from_provenance(q.provenance),
        )


class FieldModel(BaseModel):
    values: list[float]
    grid: list[float]
    unit: str
    grid_unit: str
    label: str
    provenance: ProvenanceModel

    @classmethod
    def from_field(cls, f: Field) -> "FieldModel":
        if f.values.ndim != 1:
            raise ValueError(f"I only serialize 1-D fields in M1, got shape {f.values.shape}")
        return cls(
            values=f.values.tolist(),
            grid=f.grid.tolist(),
            unit=f.unit,
            grid_unit=f.grid_unit,
            label=f.label,
            provenance=ProvenanceModel.from_provenance(f.provenance),
        )


def _to_fm(q: Quantity) -> Quantity:
    return Quantity(
        value=q.value * BOHR_RADIUS_FM,
        unit="fm",
        label=q.label + " [fm]",
        provenance=dataclasses.replace(
            q.provenance,
            method=q.provenance.method + "; converted to fm via the CODATA Bohr radius",
            error_estimate=(
                None if q.provenance.error_estimate is None
                else q.provenance.error_estimate * BOHR_RADIUS_FM
            ),
        ),
    )


class SystemModel(BaseModel):
    key: str
    name: str
    z: int
    mu_ratio: QuantityModel
    m_over_m_nucleus: float
    description: str
    nuclear_radius: QuantityModel | None
    nuclear_radius_fm: QuantityModel | None
    kind: Literal["hydrogenic", "screened"] = "hydrogenic"
    n_electrons: int | None = None
    has_gsz: bool = True

    @classmethod
    def from_system(cls, s: System) -> "SystemModel":
        r = s.nuclear_radius
        return cls(
            key=s.key,
            name=s.name,
            z=s.Z,
            mu_ratio=QuantityModel.from_quantity(s.mu_ratio),
            m_over_m_nucleus=s.m_over_M,
            description=s.description,
            nuclear_radius=None if r is None else QuantityModel.from_quantity(r),
            nuclear_radius_fm=None if r is None else QuantityModel.from_quantity(_to_fm(r)),
        )
