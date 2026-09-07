import { densityColor } from "./colormap";
import type { PlaneQuantity } from "../api/client";

export interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function rasterize(
  values: Float32Array,
  resolution: number,
  quantity: PlaneQuantity,
): Raster {
  const data = new Uint8ClampedArray(resolution * resolution * 4);
  if (quantity === "density") {
    let peak = 0;
    for (let i = 0; i < values.length; i++) if (values[i] > peak) peak = values[i];
    for (let row = 0; row < resolution; row++) {
      for (let col = 0; col < resolution; col++) {
        const src = row * resolution + col;
        const [r, g, b] = densityColor(peak > 0 ? values[src] / peak : 0);
        const dst = ((resolution - 1 - row) * resolution + col) * 4;
        data[dst] = r;
        data[dst + 1] = g;
        data[dst + 2] = b;
        data[dst + 3] = 255;
      }
    }
    return { data, width: resolution, height: resolution };
  }
  let amp = 0;
  for (let i = 0; i < values.length; i++) {
    const a = Math.abs(values[i]);
    if (a > amp) amp = a;
  }
  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      const src = row * resolution + col;
      const t = amp > 0 ? values[src] / amp : 0;
      const dst = ((resolution - 1 - row) * resolution + col) * 4;
      if (t >= 0) {
        data[dst] = 40 + 215 * t;
        data[dst + 1] = 40 + 60 * t;
        data[dst + 2] = 200 - 160 * t;
      } else {
        data[dst] = 40 + 20 * -t;
        data[dst + 1] = 60 + 40 * -t;
        data[dst + 2] = 200 + 55 * -t;
      }
      data[dst + 3] = 255;
    }
  }
  return { data, width: resolution, height: resolution };
}
