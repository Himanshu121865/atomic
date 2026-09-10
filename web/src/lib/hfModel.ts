import type { SystemInfo } from "../api/types";
import type { AtomModel } from "../lib/urlState";

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
