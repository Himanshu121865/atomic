import { describe, expect, it } from "vitest";
import type { FineLevel, Provenance, Quantity } from "../api/types";
import {
  CONST_MAX, CONST_MIN, FINE_WARN_FRACTION, REAL_ALPHA, fineErrorFraction,
  formatAlpha, formatRatio, isAlphaValid, isAltered, isBeyondValidity, shellSplitting,
} from "./whatif";

const prov: Provenance = {
  fidelity: "counterfactual", method: "", assumptions: [],
  error_estimate: null, refinement: null,
};
function q(value: number, error_estimate: number | null): Quantity {
  return { value, unit: "", label: "", provenance: { ...prov, error_estimate } };
}
function mkFine(n: number, l: number, j: number, shiftEv: number, err: number | null): FineLevel {
  return {
    n, l, j,
    energy: q(0, null), energy_ev: q(0, null),
    shift: q(shiftEv, err), shift_ev: q(shiftEv, err),
  };
}

describe("formatAlpha", () => {
  it("renders reciprocal form", () => {
    expect(formatAlpha(REAL_ALPHA)).toBe("1/137");
    expect(formatAlpha(0.02)).toBe("1/50");
    expect(formatAlpha(0)).toBe("0");
  });
});

describe("isAltered", () => {
  it("is false at the real value, true otherwise", () => {
    expect(isAltered(REAL_ALPHA, REAL_ALPHA)).toBe(false);
    expect(isAltered(0.02, REAL_ALPHA)).toBe(true);
  });
});

describe("fineErrorFraction / isBeyondValidity", () => {
  it("takes the max error_estimate/|shift| and thresholds it", () => {
    const fine = [mkFine(2, 1, 1.5, -1e-4, 2e-5), mkFine(2, 1, 0.5, -2e-4, 6e-5)];
    expect(fineErrorFraction(fine)).toBeCloseTo(0.3, 6);
    expect(isBeyondValidity(fine)).toBe(0.3 > FINE_WARN_FRACTION);
    expect(fineErrorFraction(null)).toBe(0);
  });
});

describe("shellSplitting", () => {
  it("returns the eV span of a shell's fine shifts", () => {
    const fine = [mkFine(2, 1, 1.5, 3e-6, null), mkFine(2, 1, 0.5, -1e-6, null)];
    expect(shellSplitting(fine, 2)).toBeCloseTo(4e-6, 12);
    expect(shellSplitting(fine, 3)).toBe(0);
  });
});

describe("formatAlpha beyond the reciprocal regime", () => {
  it("shows a decimal for α ≥ 0.5 (the reciprocal form is nonsense there)", () => {
    expect(formatAlpha(0.5)).toBe("0.50");
    expect(formatAlpha(7.5)).toBe("7.50");
  });
});

describe("formatRatio", () => {
  it("labels unchanged and scaled ratios", () => {
    expect(formatRatio(1)).toBe("unchanged");
    expect(formatRatio(2)).toBe("×2.00");
    expect(formatRatio(0.5)).toBe("×0.50");
  });
});

describe("isAlphaValid", () => {
  it("is true within (0, 0.5], false past it", () => {
    expect(isAlphaValid(REAL_ALPHA)).toBe(true);
    expect(isAlphaValid(0.5)).toBe(true);
    expect(isAlphaValid(0.9)).toBe(false);
    expect(isAlphaValid(0)).toBe(false);
  });
  it("multiplier bounds match the server range", () => {
    expect([CONST_MIN, CONST_MAX]).toEqual([0.25, 4]);
  });
});
