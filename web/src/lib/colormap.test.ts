import { describe, expect, it } from "vitest";
import { densityColor, inferno, phaseColor, toByte } from "./colormap";

describe("inferno", () => {
  it("runs black to near-white", () => {
    expect(inferno(0)).toEqual([0, 0, 4]);
    expect(inferno(1)).toEqual([252, 255, 164]);
    const mid = inferno(0.5);
    expect(mid[0]).toBeGreaterThan(inferno(0)[0]);
  });

  it("clamps outside [0, 1]", () => {
    expect(inferno(-2)).toEqual(inferno(0));
    expect(inferno(99)).toEqual(inferno(1));
  });
});

describe("densityColor", () => {
  it("lifts faint values with gamma", () => {
    const [r] = densityColor(0.01);
    expect(r).toBeGreaterThan(inferno(0.01)[0]);
  });
});

describe("phaseColor", () => {
  it("spans blue to red across the branch cut", () => {
    const neg = phaseColor(-Math.PI / 2, 1);
    const pos = phaseColor(Math.PI / 2, 1);
    expect(neg[2]).toBeGreaterThan(neg[0]);
    expect(pos[0]).toBeGreaterThan(pos[2]);
  });

  it("dims with brightness", () => {
    const full = phaseColor(0, 1);
    const dim = phaseColor(0, 0.5);
    expect(dim[0]).toBeLessThan(full[0]);
  });
});

describe("toByte", () => {
  it("rounds into bytes", () => {
    expect(toByte([300, -20, 128.4])).toEqual([255, 0, 128]);
  });
});
