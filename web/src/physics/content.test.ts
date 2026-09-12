import katex from "katex";
import { describe, expect, it } from "vitest";
import { PHYSICS_CONTENT } from "./content";

const VIEWS = ["cloud", "plane", "radial", "levels", "spectrum"] as const;

describe("PHYSICS_CONTENT", () => {
  it("covers every view with at least one block", () => {
    for (const v of VIEWS) {
      expect(PHYSICS_CONTENT[v].title.length).toBeGreaterThan(0);
      expect(PHYSICS_CONTENT[v].blocks.length).toBeGreaterThan(0);
    }
  });
  it("every TeX string parses strictly and every note is substantive", () => {
    for (const v of VIEWS) {
      for (const b of PHYSICS_CONTENT[v].blocks) {
        expect(() =>
          katex.renderToString(b.tex, { displayMode: true, throwOnError: true }),
        ).not.toThrow();
        expect(b.note.length).toBeGreaterThan(20);
      }
    }
  });
});
