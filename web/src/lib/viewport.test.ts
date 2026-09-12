import { describe, expect, it } from "vitest";
import { isNarrow, MIN_WIDTH } from "./viewport";

describe("isNarrow", () => {
  it("admits the threshold itself", () => {
    expect(isNarrow(MIN_WIDTH)).toBe(false);
    expect(isNarrow(MIN_WIDTH - 1)).toBe(true);
  });

  it("sends the phones and small tablets to the stacked shell", () => {
    for (const width of [390, 412, 744, 844]) {
      expect(isNarrow(width)).toBe(true);
    }
  });

  it("leaves real desktops on the three-column shell", () => {
    for (const width of [1024, 1280, 1440, 2560]) {
      expect(isNarrow(width)).toBe(false);
    }
  });

  it("keeps the threshold at the width the rails actually need", () => {
    expect(MIN_WIDTH).toBe(900);
  });
});
