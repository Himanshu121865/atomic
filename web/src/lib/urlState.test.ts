import { describe, expect, it } from "vitest";
import {
  currentUrlState,
  parseAppUrl,
  serializeAppUrl,
  URL_DEFAULTS,
} from "./urlState";

describe("parseAppUrl", () => {
  it("round-trips a full orbital address", () => {
    const parsed = parseAppUrl("?n=3&l=1&m=-1&system=mu-h");
    expect(parsed).toMatchObject({ n: 3, l: 1, m: -1, system: "mu-h" });
    const back = serializeAppUrl({ ...URL_DEFAULTS, ...parsed });
    expect(parseAppUrl(back)).toMatchObject({ n: 3, l: 1, m: -1, system: "mu-h" });
  });

  it("drops junk instead of poisoning the store", () => {
    expect(parseAppUrl("?n=banana&view=warp&system=!!!")).toEqual({});
    expect(parseAppUrl("?l=9&m=9")).toMatchObject({ l: 0, m: 0 });
  });

  it("demotes phase to density on the real basis", () => {
    expect(parseAppUrl("?basis=real&color=phase")).toMatchObject({
      basis: "real",
      colorMode: "density",
    });
    expect(parseAppUrl("?color=phase")).toMatchObject({ colorMode: "phase" });
  });

  it("reads view, basis and plane quantity", () => {
    expect(parseAppUrl("?view=radial&basis=real&plane=psi")).toMatchObject({
      view: "radial",
      basis: "real",
      planeQuantity: "psi",
    });
  });
});

describe("serializeAppUrl", () => {
  it("omits defaults entirely", () => {
    expect(serializeAppUrl(URL_DEFAULTS)).toBe("");
  });

  it("writes only what moved", () => {
    expect(serializeAppUrl({ ...URL_DEFAULTS, n: 2, view: "levels" })).toBe("?n=2&view=levels");
  });
});

describe("currentUrlState", () => {
  it("picks the addressable slice", () => {
    expect(currentUrlState({ ...URL_DEFAULTS, system: "he+" })).toMatchObject({
      system: "he+",
      n: 1,
    });
  });
});
