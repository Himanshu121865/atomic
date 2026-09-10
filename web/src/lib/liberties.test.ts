import { describe, expect, it } from "vitest";
import { formatErrorScale, HF_LADDER_AXIS_LIBERTY, RENDER_LIBERTIES } from "./liberties";

describe("formatErrorScale", () => {
  it("cuts a raw double down to a precision an error bar can support", () => {
    expect(formatErrorScale(0.00034049718827628214)).toBe("3.4e-4");
  });

  it("keeps two significant figures in the range a human reads without counting zeros", () => {
    expect(formatErrorScale(0.0034)).toBe("0.0034");
    expect(formatErrorScale(1.23456)).toBe("1.2");
  });

  it("never pads an unknown digit with a zero", () => {
    expect(formatErrorScale(4321)).toBe("4.3e+3");
    expect(formatErrorScale(123456)).toBe("1.2e+5");
  });

  it("switches to exponential where fixed notation stops being legible", () => {
    expect(formatErrorScale(1.5e-7)).toBe("1.5e-7");
  });

  it("passes through the values that should never happen rather than hiding them", () => {
    expect(formatErrorScale(0)).toBe("0");
    expect(formatErrorScale(-0.5)).toBe("-0.50");
    expect(formatErrorScale(Number.NaN)).toBe("NaN");
    expect(formatErrorScale(Number.POSITIVE_INFINITY)).toBe("Infinity");
  });
});

describe("disclosed liberties", () => {
  it("every liberty is a visual_liberty that actually says something", () => {
    for (const lib of [RENDER_LIBERTIES, HF_LADDER_AXIS_LIBERTY]) {
      expect(lib.fidelity).toBe("visual_liberty");
      expect(lib.method.length).toBeGreaterThan(0);
      expect(lib.assumptions.length).toBeGreaterThan(0);
      expect(lib.refinement).toBeTruthy();
    }
  });

  it("the log-axis liberty discloses that zero is off the scale", () => {
    expect(HF_LADDER_AXIS_LIBERTY.assumptions.join(" ")).toContain("ionization limit");
  });
});
