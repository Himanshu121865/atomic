import type { HFLevels, ManyElectronParams, SystemInfo } from "../api/types";
import type { AtomModel } from "../lib/urlState";

export interface ModelSelection {
  model: AtomModel;
  config: string | null;
  exchange: boolean;
  pauli: boolean;
}

export function manyElectronParams(s: ModelSelection): ManyElectronParams {
  return {
    model: s.model,
    config: s.config,
    exchange: s.model === "hf" ? s.exchange : true,
    pauli: s.model === "hf" ? s.pauli : true,
  };
}

export const HF_ORBITAL_CAPTION =
  "This is one orbital of a self-consistent field, and an orbital is not an " +
  "observable. The atom's total density is exactly spherical, so the shape on " +
  "screen is a basis choice rather than a photograph. The lobes are still this " +
  "model's own answer: restricted Hartree-Fock leaves the angular part exactly " +
  "Yₗₘ.";

export function gszAvailable(systems: SystemInfo[], system: string): boolean {
  const info = systems.find((s) => s.key === system);
  return info === undefined || info.has_gsz;
}

export function resolveModel(
  systems: SystemInfo[],
  system: string,
  model: AtomModel,
): AtomModel {
  return gszAvailable(systems, system) ? model : "hf";
}

export function compareAvailable(systems: SystemInfo[], system: string): boolean {
  const info = systems.find((s) => s.key === system);
  return info !== undefined && info.kind === "screened" && info.has_gsz;
}

export function resolveCompare(
  systems: SystemInfo[],
  system: string,
  compare: boolean,
): boolean {
  return compareAvailable(systems, system) && compare;
}

export function subshellAvailable(
  hf: HFLevels | null,
  model: AtomModel,
  n: number,
  l: number,
): boolean {
  if (model !== "hf" || hf === null) return true;
  return hf.orbitals.some((o) => o.n === n && o.l === l);
}
