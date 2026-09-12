import aRealSpectrum from "./a-real-spectrum.json";
import breakThePhysics from "./break-the-physics.json";
import hydrogenHonestly from "./hydrogen-honestly.json";
import manyElectrons from "./many-electrons.json";
import type { Tour } from "./types";

export const TOURS: Tour[] = [
  hydrogenHonestly as Tour,
  breakThePhysics as Tour,
  manyElectrons as Tour,
  aRealSpectrum as Tour,
];

export function tourById(id: string): Tour | null {
  return TOURS.find((t) => t.id === id) ?? null;
}

export const FLAGSHIP_TOUR_ID = "hydrogen-honestly";
