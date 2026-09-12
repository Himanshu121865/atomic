import { describe, expect, it } from "vitest";
import { TOURS } from "./registry";

const SOURCES = import.meta.glob("../components/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function declaredAnchors(): Set<string> {
  const out = new Set<string>();
  for (const src of Object.values(SOURCES)) {
    for (const m of src.matchAll(/(?:data-tour|tourId)="([^"]+)"/g)) out.add(m[1]);
  }
  return out;
}

describe("spotlight anchors", () => {
  it("every anchor a tour names exists in a component", () => {
    const have = declaredAnchors();
    for (const t of TOURS) {
      for (const s of t.steps) {
        if (s.spotlight) {
          expect(have, `${t.id}/${s.id} points at a missing anchor`).toContain(s.spotlight);
        }
      }
    }
  });

  it("reads the component sources at all, so a broken scan cannot pass vacuously", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(0);
    expect(declaredAnchors().size).toBeGreaterThan(0);
  });
});
