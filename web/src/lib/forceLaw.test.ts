import { describe, expect, it } from "vitest";
import { clampParam, defaultParams, PRESET_PARAMS, validateExprClient } from "./forceLaw";

describe("forceLaw helpers", () => {
  it("defaults match the engine specs", () => {
    expect(defaultParams("powerlaw")).toEqual({ p: 1.0 });
    expect(defaultParams("custom")).toEqual({});
  });

  it("clamps to spec ranges", () => {
    const spec = PRESET_PARAMS.yukawa[0];
    expect(clampParam(spec, 99)).toBe(20);
    expect(clampParam(spec, -1)).toBe(0.5);
    expect(clampParam(spec, 3)).toBe(3);
  });

  it("pre-checks expressions like the server will", () => {
    expect(validateExprClient("")).not.toBeNull();
    expect(validateExprClient("r(")).not.toBeNull();
    expect(validateExprClient("-1/r")).toBeNull();
  });
});
