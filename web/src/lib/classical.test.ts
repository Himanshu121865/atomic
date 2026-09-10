import { describe, expect, it } from "vitest";
import { ghostRadius, ghostAngle, slowMotionFactor, tauFromWall, formatSeconds } from "./classical";

describe("classical trajectory law", () => {
  it("radius follows r0*(1-tau)^(1/3), full at tau=0, zero at tau=1", () => {
    expect(ghostRadius(0, 2)).toBeCloseTo(2, 12);
    expect(ghostRadius(1, 2)).toBeCloseTo(0, 12);
    expect(ghostRadius(0.5, 1)).toBeCloseTo(Math.cbrt(0.5), 12);
  });
  it("angle sweeps 0 to 2*pi*N over the collapse", () => {
    expect(ghostAngle(0, 3)).toBeCloseTo(0, 12);
    expect(ghostAngle(1, 3)).toBeCloseTo(2 * Math.PI * 3, 12);
  });
  it("slow-motion factor is wall-duration over real collapse time", () => {
    expect(slowMotionFactor(1.556e-11, 5)).toBeCloseTo(5 / 1.556e-11, 3);
  });
  it("tau loops in [0,1) from wall time", () => {
    expect(tauFromWall(0, 5)).toBeCloseTo(0, 12);
    expect(tauFromWall(2.5, 5)).toBeCloseTo(0.5, 12);
    expect(tauFromWall(7.5, 5)).toBeCloseTo(0.5, 12); // wrapped
  });
  it("formats seconds into readable ps/fs", () => {
    expect(formatSeconds(1.556e-11)).toMatch(/ps/);
    expect(formatSeconds(1.5e-15)).toMatch(/fs/);
  });
});
