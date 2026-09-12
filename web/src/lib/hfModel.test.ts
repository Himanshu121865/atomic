import { describe, expect, it } from "vitest";
import type { HFLevels, SystemInfo } from "../api/types";
import {
  HF_ORBITAL_CAPTION,
  compareAvailable,
  gszAvailable,
  manyElectronParams,
  resolveCompare,
  resolveModel,
  subshellAvailable,
} from "./hfModel";

const NEON = {
  kind: "hf",
  z: 10,
  n_electrons: 10,
  config: "1s2 2s2 2p6",
  orbitals: [
    { n: 1, l: 0 },
    { n: 2, l: 0 },
    { n: 2, l: 1 },
  ],
} as unknown as HFLevels;

describe("manyElectronParams", () => {
  it("carries all four fields a job needs", () => {
    const p = manyElectronParams({
      model: "hf",
      config: "1s2 2s2 2p5 3s1",
      exchange: false,
      pauli: true,
    });
    expect(p).toEqual({
      model: "hf",
      config: "1s2 2s2 2p5 3s1",
      exchange: false,
      pauli: true,
    });
  });

  it("sends the real physics under the screened model", () => {
    const p = manyElectronParams({
      model: "gsz",
      config: "1s2 2s2 2p6",
      exchange: false,
      pauli: false,
    });
    expect(p).toEqual({
      model: "gsz",
      config: "1s2 2s2 2p6",
      exchange: true,
      pauli: true,
    });
  });
});

describe("subshellAvailable", () => {
  it("allows everything under the screened model", () => {
    expect(subshellAvailable(null, "gsz", 3, 2)).toBe(true);
    expect(subshellAvailable(NEON, "gsz", 3, 2)).toBe(true);
  });

  it("allows everything before the solve has landed", () => {
    expect(subshellAvailable(null, "hf", 3, 2)).toBe(true);
  });

  it("allows an occupied subshell and refuses an empty one", () => {
    expect(subshellAvailable(NEON, "hf", 2, 1)).toBe(true);
    expect(subshellAvailable(NEON, "hf", 1, 0)).toBe(true);
    expect(subshellAvailable(NEON, "hf", 3, 2)).toBe(false);
    expect(subshellAvailable(NEON, "hf", 3, 0)).toBe(false);
  });
});

const TABLE = [
  { key: "ar", kind: "screened", has_gsz: true },
  { key: "s", kind: "screened", has_gsz: false },
  { key: "h", kind: "hydrogenic", has_gsz: true },
] as unknown as SystemInfo[];

describe("gszAvailable", () => {
  it("reads the flag off the table", () => {
    expect(gszAvailable(TABLE, "ar")).toBe(true);
    expect(gszAvailable(TABLE, "s")).toBe(false);
  });

  it("says yes for an atom the table has not described yet", () => {
    expect(gszAvailable([], "s")).toBe(true);
    expect(gszAvailable(TABLE, "kr")).toBe(true);
  });
});

describe("resolveModel", () => {
  it("leaves a workable choice alone", () => {
    expect(resolveModel(TABLE, "ar", "gsz")).toBe("gsz");
    expect(resolveModel(TABLE, "ar", "hf")).toBe("hf");
    expect(resolveModel(TABLE, "h", "gsz")).toBe("gsz");
  });

  it("moves sulfur off the model that has no parameters for it", () => {
    expect(resolveModel(TABLE, "s", "gsz")).toBe("hf");
    expect(resolveModel(TABLE, "s", "hf")).toBe("hf");
  });

  it("waits for the table rather than guessing", () => {
    expect(resolveModel([], "s", "gsz")).toBe("gsz");
  });
});

describe("compareAvailable", () => {
  it("is true for an atom both models can draw", () => {
    expect(compareAvailable(TABLE, "ar")).toBe(true);
  });

  it("is false where GSZ has no parameters, since there is nothing to compare", () => {
    expect(compareAvailable(TABLE, "s")).toBe(false);
  });

  it("is false for a one-electron system, which has no total density at all", () => {
    expect(compareAvailable(TABLE, "h")).toBe(false);
  });

  it("is false while the system table is still loading", () => {
    expect(compareAvailable([], "ar")).toBe(false);
  });
});

describe("resolveCompare", () => {
  it("turns a deep-linked compare off where it cannot run", () => {
    expect(resolveCompare(TABLE, "s", true)).toBe(false);
  });

  it("leaves it alone where it can", () => {
    expect(resolveCompare(TABLE, "ar", true)).toBe(true);
  });
});

describe("HF_ORBITAL_CAPTION", () => {
  it("says both halves of the claim", () => {
    expect(HF_ORBITAL_CAPTION).toContain("not an observable");
    expect(HF_ORBITAL_CAPTION).toContain("spherical");
  });
});
