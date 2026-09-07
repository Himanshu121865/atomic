import { describe, expect, it } from "vitest";
import { cloudColors, toScreen } from "./cloudColors";

describe("toScreen", () => {
  it("maps the engine z axis to screen up", () => {
    expect(toScreen([1, 2, 3])).toEqual([1, 3, -2]);
  });
});

describe("cloudColors", () => {
  const density = new Float32Array([1, 0.25]);

  it("paints solid clouds one color", () => {
    const out = cloudColors(density, null, "solid");
    expect(out).toHaveLength(6);
    expect([out[0], out[1], out[2]]).toEqual([out[3], out[4], out[5]]);
  });

  it("scales density colors by the peak", () => {
    const out = cloudColors(density, null, "density");
    const bright = out[0] + out[1] + out[2];
    const faint = out[3] + out[4] + out[5];
    expect(bright).toBeGreaterThan(faint);
  });

  it("falls back to density colors without phase data", () => {
    const a = cloudColors(density, null, "phase");
    const b = cloudColors(density, null, "density");
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("colors phase by angle", () => {
    const phase = new Float32Array([Math.PI / 2, -Math.PI / 2]);
    const out = cloudColors(density, phase, "phase");
    expect(out[0]).toBeGreaterThan(out[2]);
    expect(out[5]).toBeGreaterThan(out[3]);
  });
});
