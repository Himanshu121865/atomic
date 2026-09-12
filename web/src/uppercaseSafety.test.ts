import { describe, expect, it } from "vitest";

const CSS = import.meta.glob("./*.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const ALLOWED = new Set([
  ".control-group > .control-group-title",
  ".control-choice > legend",
  ".ghost-banner",
]);

function uppercasingSelectors(css: string): string[] {
  const out: string[] = [];
  for (const chunk of css.split("}")) {
    const brace = chunk.indexOf("{");
    if (brace < 0) continue;
    const body = chunk.slice(brace + 1);
    if (!/text-transform:\s*uppercase/.test(body)) continue;
    const selector = chunk
      .slice(0, brace)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim()
      .replace(/\s+/g, " ");
    if (selector) out.push(selector);
  }
  return out;
}

describe("uppercase safety", () => {
  const css = Object.values(CSS)[0];

  it("reads the stylesheet at all, so a broken scan cannot pass vacuously", () => {
    expect(css).toBeDefined();
    expect(css.length).toBeGreaterThan(1000);
    expect(css).toContain("text-transform");
  });

  it("uppercases only selectors that can hold nothing but plain words", () => {
    for (const selector of uppercasingSelectors(css)) {
      expect(
        ALLOWED.has(selector),
        `${selector} uppercases text. CSS uppercasing maps a to A and squared ` +
          `to 2, so it may only be applied where the string is guaranteed to ` +
          `be plain words. Add it to ALLOWED only after checking that.`,
      ).toBe(true);
    }
  });

  it("does not uppercase the counterfactual banner, which carries a derived alpha", () => {
    expect(uppercasingSelectors(css)).not.toContain(".counterfactual-banner");
  });

  it("finds the selectors it is meant to be guarding", () => {
    expect(uppercasingSelectors(css).length).toBeGreaterThan(0);
  });
});
