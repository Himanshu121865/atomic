import { describe, expect, it } from "vitest";
import { clampState, isValidState, realOrbitalLabel, stateLabel } from "./quantum";

describe("isValidState", () => {
  it("accepts 1s and rejects nonsense", () => {
    expect(isValidState(1, 0, 0)).toBe(true);
    expect(isValidState(3, 1, -1)).toBe(true);
    expect(isValidState(0, 0, 0)).toBe(false);
    expect(isValidState(2, 2, 0)).toBe(false);
    expect(isValidState(2, 1, 2)).toBe(false);
    expect(isValidState(1.5, 0, 0)).toBe(false);
  });
});

describe("clampState", () => {
  it("pulls l and m into range", () => {
    expect(clampState(2, 5, 9)).toEqual({ n: 2, l: 1, m: 1 });
    expect(clampState(0, 0, 0)).toEqual({ n: 1, l: 0, m: 0 });
    expect(clampState(3, 1, -1)).toEqual({ n: 3, l: 1, m: -1 });
  });
});

describe("labels", () => {
  it("names states and chemistry orbitals", () => {
    expect(stateLabel(2, 1, 0)).toBe("2p (m = 0)");
    expect(realOrbitalLabel(1, 1)).toBe("p_x");
    expect(realOrbitalLabel(2, -2)).toBe("d_xy");
    expect(realOrbitalLabel(4, 3)).toBe("g(m=+3, cos)");
  });
});
