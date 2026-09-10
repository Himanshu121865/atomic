import { describe, expect, it } from "vitest";
import type { SystemInfo } from "../api/types";
import {
  HF_ORBITAL_CAPTION,
  gszAvailable,
  resolveModel,
} from "./hfModel";

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

describe("HF_ORBITAL_CAPTION", () => {
  it("says both halves of the claim", () => {
    expect(HF_ORBITAL_CAPTION).toContain("not an observable");
    expect(HF_ORBITAL_CAPTION).toContain("spherical");
  });
});
