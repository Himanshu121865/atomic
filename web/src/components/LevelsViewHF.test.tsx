import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HFLevels, Provenance } from "../api/types";
import { LevelsView } from "./LevelsView";

const backing = vi.hoisted(() => ({ cur: {} as Record<string, unknown> }));

vi.mock("../state/store", () => ({
  useAppStore: () => backing.cur,
}));

const PROV: Provenance = {
  fidelity: "approximation",
  method: "m",
  assumptions: [],
  error_estimate: null,
  refinement: null,
};

function qty(value: number) {
  return { value, unit: "eV", label: "E", provenance: { ...PROV } };
}

const hartree: HFLevels = {
  kind: "hf",
  z: 4,
  n_electrons: 4,
  symbol: "Be",
  config: "1s2 2s2",
  is_ground: true,
  exchange: false,
  exchange_energy: qty(-1.74),
  exchange_energy_ev: qty(-47.3),
  pauli: true,
  collapse: null,
  orbitals: [
    { n: 1, l: 0, label: "1s", occupancy: 2, energy: qty(-128), energy_ev: qty(-128), channel: "P_1s" },
    { n: 2, l: 0, label: "2s", occupancy: 2, energy: qty(-9), energy_ev: qty(-9), channel: "P_2s" },
  ],
  total_energy: qty(-14),
  total_energy_ev: qty(-380),
  kinetic: qty(14),
  potential: qty(-28),
  virial_ratio: qty(2),
  iterations: 3,
  coarse_iterations: 12,
  converged: true,
  provenance: { ...PROV },
  grid_channel: "grid",
  grid_points: 1400,
  channels: [],
};

function hfState(over: Record<string, unknown> = {}) {
  backing.cur = {
    n: 1,
    l: 0,
    system: "be",
    levels: null,
    loadLevels: vi.fn(),
    setQuantumNumbers: vi.fn(),
    fineStructure: false,
    setFineStructure: vi.fn(),
    dirac: false,
    setDirac: vi.fn(),
    bField: 0,
    setBField: vi.fn(),
    eField: 0,
    setEField: vi.fn(),
    hyperfine: false,
    setHyperfine: vi.fn(),
    model: "hf",
    config: null,
    exchange: true,
    pauli: true,
    hfLevels: null,
    hfStatus: "idle",
    loadHF: vi.fn(),
    error: null,
    ...over,
  };
}

describe("LevelsView under the HF model", () => {
  it("routes to the ladder instead of the gross shells", () => {
    hfState({ hfLevels: hartree, hfStatus: "ready" });
    const html = renderToStaticMarkup(<LevelsView />);
    expect(html).toContain("Energy levels: Hartree (no exchange)");
    expect(html).not.toContain("Loading the levels");
  });

  it("waits for the solve instead of showing stale rungs", () => {
    hfState({ hfLevels: null, hfStatus: "idle" });
    expect(renderToStaticMarkup(<LevelsView />)).toContain("Solving Hartree-Fock");
  });

  it("says when the solve failed", () => {
    hfState({ hfLevels: null, hfStatus: "error", error: "no convergence" });
    expect(renderToStaticMarkup(<LevelsView />)).toContain("could not solve");
  });
});
