import { densityColor, phaseColor } from "./colormap";
import type { ColorMode } from "./urlState";

export function toScreen(p: [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

export function cloudColors(
  density: Float32Array,
  phase: Float32Array | null,
  mode: ColorMode,
): Float32Array {
  const n = density.length;
  const out = new Float32Array(n * 3);
  let peak = 0;
  for (let i = 0; i < n; i++) if (density[i] > peak) peak = density[i];
  for (let i = 0; i < n; i++) {
    let r: number;
    let g: number;
    let b: number;
    if (mode === "solid") {
      r = 191;
      g = 214;
      b = 242;
    } else if (mode === "phase" && phase !== null) {
      const v = peak > 0 ? 0.25 + (0.75 * density[i]) / peak : 1;
      [r, g, b] = phaseColor(phase[i], v);
    } else {
      [r, g, b] = densityColor(peak > 0 ? density[i] / peak : 0);
    }
    out[3 * i] = r / 255;
    out[3 * i + 1] = g / 255;
    out[3 * i + 2] = b / 255;
  }
  return out;
}
