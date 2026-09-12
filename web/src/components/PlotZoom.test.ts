import { describe, expect, it } from "vitest";
import { startsPan } from "./PlotZoom";

describe("startsPan", () => {
  it("pans under a mouse and a pen", () => {
    expect(startsPan({ button: 0, pointerType: "mouse" })).toBe(true);
    expect(startsPan({ button: 0, pointerType: "pen" })).toBe(true);
  });

  it("leaves a finger to the page", () => {
    expect(startsPan({ button: 0, pointerType: "touch" })).toBe(false);
  });

  it("ignores the other mouse buttons, as it always did", () => {
    expect(startsPan({ button: 1, pointerType: "mouse" })).toBe(false);
    expect(startsPan({ button: 2, pointerType: "mouse" })).toBe(false);
  });
});
