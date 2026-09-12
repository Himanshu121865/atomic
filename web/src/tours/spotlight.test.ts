import { describe, expect, it } from "vitest";
import { spotlightBox } from "./spotlight";

describe("spotlightBox", () => {
  it("pads the ring out from the control", () => {
    const b = spotlightBox({ left: 10, top: 20, width: 100, height: 40 }, 6);
    expect(b).toEqual({ x: 4, y: 14, w: 112, h: 52 });
  });

  it("returns null for a control with no box", () => {
    expect(spotlightBox({ left: 0, top: 0, width: 0, height: 0 }, 6)).toBeNull();
  });
});
