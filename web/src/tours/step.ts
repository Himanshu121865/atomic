import { URL_DEFAULTS, type UrlState } from "../lib/urlState";
import type { Tour, TourStep } from "./types";

export function stepState(step: TourStep): UrlState {
  return {
    ...URL_DEFAULTS,
    labConst: { ...URL_DEFAULTS.labConst },
    forceParams: { ...URL_DEFAULTS.forceParams },
    ...step.state,
  };
}

export function clampStep(tour: Tour, i: number): number {
  if (!Number.isFinite(i)) return 0;
  const last = tour.steps.length - 1;
  if (last < 0) return 0;
  return Math.min(Math.max(Math.floor(i), 0), last);
}
