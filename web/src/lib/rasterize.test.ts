import { describe, expect, it } from "vitest";
import { INFERNO, RDBU_R } from "./luts";
import { rasterize } from "./rasterize";

describe("rasterize", () => {
  it("maps density extremes through inferno and flips rows (+z up)", () => {
    const values = new Float32Array([0, 0.5, 1, 2]);
    const px = rasterize(values, 2, "density");
    expect(px).toHaveLength(16);
    const top = INFERNO[255];
    expect([px[4], px[5], px[6], px[7]]).toEqual([top[0], top[1], top[2], 255]);
    const zero = INFERNO[0];
    expect([px[8], px[9], px[10], px[11]]).toEqual([zero[0], zero[1], zero[2], 255]);
  });

  it("maps signed psi through diverging RdBu_r with zero at the midpoint", () => {
    const values = new Float32Array([-2, 0, 2, 1]);
    const px = rasterize(values, 2, "psi");
    const pos = RDBU_R[255];
    expect([px[0], px[1], px[2]]).toEqual([pos[0], pos[1], pos[2]]);
    const neg = RDBU_R[0];
    expect([px[8], px[9], px[10]]).toEqual([neg[0], neg[1], neg[2]]);
    const mid = RDBU_R[128];
    expect([px[12], px[13], px[14]]).toEqual([mid[0], mid[1], mid[2]]);
  });
});
