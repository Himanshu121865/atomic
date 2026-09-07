import { describe, expect, it } from "vitest";
import { rasterize } from "./rasterize";

describe("rasterize", () => {
  it("paints density with an opaque inferno ramp", () => {
    const values = new Float32Array([0, 0.5, 0.5, 1]);
    const { data, width, height } = rasterize(values, 2, "density");
    expect(width).toBe(2);
    expect(height).toBe(2);
    expect(data).toHaveLength(16);
    for (let i = 3; i < 16; i += 4) expect(data[i]).toBe(255);
    const peak = 1 * 4;
    const flat = 2 * 4;
    expect(data[peak] + data[peak + 1] + data[peak + 2]).toBeGreaterThan(
      data[flat] + data[flat + 1] + data[flat + 2],
    );
  });

  it("flips rows so +z is up", () => {
    const values = new Float32Array([1, 0, 0, 0]);
    const { data } = rasterize(values, 2, "density");
    const topLeft = 0 * 4;
    const bottomLeft = 2 * 4;
    const topSum = data[topLeft] + data[topLeft + 1] + data[topLeft + 2];
    const bottomSum = data[bottomLeft] + data[bottomLeft + 1] + data[bottomLeft + 2];
    expect(bottomSum).toBeGreaterThan(topSum);
  });

  it("paints psi by sign", () => {
    const values = new Float32Array([1, -1, 0.5, -0.5]);
    const { data } = rasterize(values, 2, "psi");
    const pos = 0 * 4;
    const neg = 1 * 4;
    expect(data[pos]).toBeGreaterThan(data[pos + 2]);
    expect(data[neg + 2]).toBeGreaterThan(data[neg]);
  });
});
