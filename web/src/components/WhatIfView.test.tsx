import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LevelsResponse, Provenance, Quantity } from "../api/types";
import { WhatIfView } from "./WhatIfView";

const backing = vi.hoisted(() => ({ cur: {} as Record<string, unknown> }));

vi.mock("../state/store", () => ({
  useAppStore: () => backing.cur,
}));

const PROV: Provenance = {
  fidelity: "counterfactual",
  method: "m",
  assumptions: [],
  error_estimate: null,
  refinement: null,
};

function qty(value: number): Quantity {
  return { value, unit: "u", label: "q", provenance: { ...PROV } };
}

function obs(value: number, changed: boolean) {
  return { quantity: qty(value), ratio: changed ? 2 : 1, changed };
}

const gross = [1, 2, 3].map((n) => ({
  n,
  degeneracy: 2 * n * n,
  energy: qty(-0.5 / (n * n)),
  energy_ev: qty(-13.6 / (n * n)),
}));

const fine = [
  { n: 2, l: 1, j: 0.5, energy: qty(0), energy_ev: qty(0), shift: qty(-1e-7), shift_ev: qty(-2.7e-6) },
  { n: 2, l: 1, j: 1.5, energy: qty(0), energy_ev: qty(0), shift: qty(1e-7), shift_ev: qty(2.7e-6) },
];

const real = {
  system: { z: 1 },
  gross,
  fine,
} as unknown as LevelsResponse;

function labState(over: Record<string, unknown> = {}) {
  backing.cur = {
    labConst: { hbar: 1, e: 2, m_e: 1, eps0: 1, c: 1 },
    labZ: 1,
    setLabConst: vi.fn(),
    setLabZ: vi.fn(),
    loadWhatIf: vi.fn(),
    loadGhost: vi.fn(),
    ghost: null,
    ghostStatus: "idle",
    n: 1,
    system: "h",
    whatifStatus: "ready",
    ...over,
  };
}

const report = {
  alpha: obs(0.0146, true),
  bohr_radius_pm: obs(52.9, false),
  hartree_ev: obs(27.2, false),
  altered: true,
};

describe("WhatIfView scenarios and spread plot", () => {
  it("offers the prepared universes and marks the active one", () => {
    labState({ whatif: { report, real, altered: null } });
    const html = renderToStaticMarkup(<WhatIfView />);
    expect(html).toContain("Prepared universes");
    expect(html).toContain("same universe in disguise");
    expect(html).toContain("COUNTERFACTUAL");
  });

  it("draws the gross ladder and the real-vs-altered fine split", () => {
    labState({ whatif: { report, real, altered: { ...real } } });
    const html = renderToStaticMarkup(<WhatIfView />);
    expect(html).toContain("gross levels");
    expect(html).toContain("fine split");
    expect(html).toContain("real");
    expect(html).toContain("altered");
  });

  it("says the honest boundary instead of drawing past it", () => {
    labState({ whatif: { report, real, altered: null } });
    expect(renderToStaticMarkup(<WhatIfView />)).toContain("honest boundary");
  });

  it("steps the lab nuclear charge without touching the sky", () => {
    labState({ whatif: { report, real, altered: null } });
    const html = renderToStaticMarkup(<WhatIfView />);
    expect(html).toContain("nuclear charge Z");
    expect(html).toContain("reset to real constants");
  });

  it("waits for the lab instead of rendering numbers it does not have", () => {
    labState({ whatif: null, whatifStatus: "idle" });
    expect(renderToStaticMarkup(<WhatIfView />)).toContain("Loading the What-If lab");
  });
});
