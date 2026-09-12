import type { FineLevel } from "../api/types";

export const REAL_ALPHA = 0.0072973525643;

export const ALPHA_MAX = 0.5;

export const FINE_WARN_FRACTION = 0.1;

export function formatAlpha(alpha: number): string {
  if (alpha <= 0) return "0";
  if (alpha >= 0.5) return alpha.toFixed(2);
  return `1/${Math.round(1 / alpha)}`;
}

export function isAltered(alpha: number, realAlpha: number): boolean {
  return Math.abs(alpha - realAlpha) > 1e-12 * realAlpha;
}

export function fineErrorFraction(fine: FineLevel[] | null): number {
  if (!fine || fine.length === 0) return 0;
  let max = 0;
  for (const f of fine) {
    const err = f.shift.provenance.error_estimate;
    const mag = Math.abs(f.shift.value);
    if (err !== null && mag > 0) max = Math.max(max, err / mag);
  }
  return max;
}

export function isBeyondValidity(fine: FineLevel[] | null): boolean {
  return fineErrorFraction(fine) > FINE_WARN_FRACTION;
}

export function shellSplitting(fine: FineLevel[] | null, n: number): number {
  const s = (fine ?? []).filter((f) => f.n === n).map((f) => f.shift_ev.value);
  if (s.length < 2) return 0;
  return Math.max(...s) - Math.min(...s);
}

export function isAlphaValid(alpha: number): boolean {
  return alpha > 0 && alpha <= ALPHA_MAX;
}

export const CONST_MIN = 0.25;
export const CONST_MAX = 4;

export const CONSTANT_KEYS = ["hbar", "e", "m_e", "eps0", "c"] as const;
export type ConstantKey = (typeof CONSTANT_KEYS)[number];

export const CONSTANT_LABELS: Record<ConstantKey, string> = {
  hbar: "ℏ",
  e: "e",
  m_e: "mₑ",
  eps0: "ε₀",
  c: "c",
};

export function formatRatio(ratio: number): string {
  if (Math.abs(ratio - 1) < 1e-9) return "unchanged";
  return `×${ratio.toFixed(2)}`;
}
