import { describe, expect, it } from "vitest";
import { formatSeconds } from "./classical";
import { CONSTANT_KEYS, formatRatio } from "./whatif";

describe("whatif helpers", () => {
  it("names five constants and formats ratios", () => {
    expect(CONSTANT_KEYS).toHaveLength(5);
    expect(formatRatio(1)).toBe("unchanged");
    expect(formatRatio(2)).toBe("×2.00");
  });
});

describe("formatSeconds", () => {
  it("picks human units", () => {
    expect(formatSeconds(1.556e-11)).toContain("ps");
    expect(formatSeconds(1e-14)).toContain("fs");
  });
});
