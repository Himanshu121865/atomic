import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Provenance, SystemInfo } from "../api/types";
import { useAppStore } from "../state/store";
import { LevelsLadder, LevelsView } from "./LevelsView";

const PROV: Provenance = {
  fidelity: "exact",
  method: "m",
  assumptions: [],
  error_estimate: null,
  refinement: null,
};

function qty(value: number) {
  return { value, unit: "eV", label: "E", provenance: { ...PROV } };
}

const SYS: SystemInfo = {
  key: "h",
  name: "Hydrogen",
  z: 1,
  mu_ratio: { value: 1, unit: "m_e", label: "m", provenance: { ...PROV } },
  m_over_m_nucleus: 0,
  description: "h",
  nuclear_radius: null,
  nuclear_radius_fm: null,
  kind: "hydrogenic",
  n_electrons: null,
  has_gsz: true,
};

describe("LevelsView", () => {
  it("asks to wait with no data", () => {
    useAppStore.setState({ levels: null });
    expect(renderToStaticMarkup(<LevelsView />)).toContain("Loading the levels");
  });

  it("draws one rung per shell with energies and degeneracies", () => {
    const levels = {
      system: { ...SYS },
      n_max: 2,
      levels: [
        { n: 1, energy: qty(-13.6), energy_ev: qty(-13.6), degeneracy: 2 },
        { n: 2, energy: qty(-3.4), energy_ev: qty(-3.4), degeneracy: 8 },
      ],
    };
    const html = renderToStaticMarkup(
      <LevelsLadder levels={levels} activeN={2} maxL={1} onPick={() => {}} />,
    );
    expect(html).toContain("n=1");
    expect(html).toContain("-13.60 eV");
    expect(html).toContain("2n²=8");
    expect(html).toContain("ground state");
    expect(html).toContain("ionization limit");
  });

  it("reports rung picks to the store", () => {
    const levels = {
      system: { ...SYS },
      n_max: 2,
      levels: [{ n: 1, energy: qty(-13.6), energy_ev: qty(-13.6), degeneracy: 2 }],
    };
    const onPick = vi.fn();
    renderToStaticMarkup(<LevelsLadder levels={levels} activeN={1} maxL={0} onPick={onPick} />);
    expect(onPick).not.toHaveBeenCalled();
    useAppStore.getState().setQuantumNumbers(2, 1, 0);
    expect(useAppStore.getState().n).toBe(2);
  });
});
