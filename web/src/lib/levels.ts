import type { SpectralLineInfo } from "../api/types";

export function arrowsFor(
  lines: readonly SpectralLineInfo[],
  n: number,
  l: number,
): SpectralLineInfo[] {
  return lines.filter((ln) => ln.n_upper === n && ln.l_upper === l);
}

export type DetailMode = "none" | "fine" | "zeeman" | "stark" | "hyperfine";

export interface DetailState {
  fineStructure: boolean;
  bField: number;
  eField: number;
  hyperfine: boolean;
}

export function detailMode(s: DetailState): DetailMode {
  if (s.eField > 0) return "stark";
  if (s.hyperfine) return "hyperfine";
  if (!s.fineStructure) return "none";
  return s.bField > 0 ? "zeeman" : "fine";
}

export const DEFAULT_B_TESLA = 2;
export const DEFAULT_E_MV_PER_M = 20;

export function detailState(mode: DetailMode, current: DetailState): DetailState {
  switch (mode) {
    case "none":
      return { fineStructure: false, bField: 0, eField: 0, hyperfine: false };
    case "fine":
      return { fineStructure: true, bField: 0, eField: 0, hyperfine: false };
    case "zeeman":
      return {
        fineStructure: true,
        bField: current.bField > 0 ? current.bField : DEFAULT_B_TESLA,
        eField: 0,
        hyperfine: false,
      };
    case "stark":
      return {
        fineStructure: current.fineStructure,
        bField: current.bField,
        eField: current.eField > 0 ? current.eField : DEFAULT_E_MV_PER_M,
        hyperfine: false,
      };
    case "hyperfine":
      return {
        fineStructure: current.fineStructure,
        bField: current.bField,
        eField: 0,
        hyperfine: true,
      };
  }
}

export function spreadLabels(
  ys: readonly number[],
  minGap: number,
  lo: number,
  hi: number,
): number[] {
  const n = ys.length;
  if (n === 0) return [];
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const sorted = order.map((i) => ys[i]);
  const out = sorted.slice();
  for (let i = 1; i < n; i++) {
    if (out[i] - out[i - 1] < minGap) out[i] = out[i - 1] + minGap;
  }
  const overflow = out[n - 1] - hi;
  if (overflow > 0) {
    for (let i = 0; i < n; i++) out[i] -= overflow;
    for (let i = n - 2; i >= 0; i--) {
      if (out[i + 1] - out[i] < minGap) out[i] = out[i + 1] - minGap;
    }
  }
  for (let i = 0; i < n; i++) out[i] = Math.max(out[i], lo);
  const result = new Array<number>(n);
  order.forEach((src, i) => {
    result[src] = out[i];
  });
  return result;
}
