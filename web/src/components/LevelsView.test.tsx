import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { isScreenedLevels } from "../api/client";
import type { Provenance, ScreenedLevels, SystemInfo } from "../api/types";
import { useAppStore } from "../state/store";
import { FineFan, LevelsLadder, LevelsView, ScreenedLadder, ZeemanFan } from "./LevelsView";

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
      fine_structure: false,
      alpha: 1 / 137,
      dirac: false,
      b_field: 0,
      e_field: 0,
      hyperfine: false,
      fine: null,
      gross: [
        { n: 1, degeneracy: 2, energy: qty(-13.6), energy_ev: qty(-13.6) },
        { n: 2, degeneracy: 8, energy: qty(-3.4), energy_ev: qty(-3.4) },
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
      fine_structure: false,
      alpha: 1 / 137,
      dirac: false,
      b_field: 0,
      e_field: 0,
      hyperfine: false,
      fine: null,
      gross: [{ n: 1, degeneracy: 2, energy: qty(-13.6), energy_ev: qty(-13.6) }],
    };
    const onPick = vi.fn();
    renderToStaticMarkup(<LevelsLadder levels={levels} activeN={1} maxL={0} onPick={onPick} />);
    expect(onPick).not.toHaveBeenCalled();
    useAppStore.getState().setQuantumNumbers(2, 1, 0);
    expect(useAppStore.getState().n).toBe(2);
  });

  it("shows the fine split of the selected shell in µeV", () => {
    const shell = [
      { n: 2, l: 1, j: 0.5, energy: qty(-3.4), energy_ev: qty(-3.4), shift: qty(-4.5e-6), shift_ev: qty(-4.5e-6) },
      { n: 2, l: 1, j: 1.5, energy: qty(-3.4), energy_ev: qty(-3.4), shift: qty(-4.5e-6), shift_ev: qty(-4.5e-6) },
    ];
    const html = renderToStaticMarkup(
      <FineFan shell={shell} grossEv={-3.4} dirac={false} />,
    );
    expect(html).toContain("α² fine structure");
    expect(html).toContain("µeV");
  });

  it("labels the Dirac fan with the degeneracy caption", () => {
    const shell = [
      { n: 2, l: 0, j: 0.5, energy: qty(-3.4), energy_ev: qty(-3.4), shift: qty(0), shift_ev: qty(0) },
      { n: 2, l: 1, j: 0.5, energy: qty(-3.4), energy_ev: qty(-3.4), shift: qty(0), shift_ev: qty(0) },
    ];
    const html = renderToStaticMarkup(
      <FineFan shell={shell} grossEv={-3.4} dirac={true} />,
    );
    expect(html).toContain("Dirac exact");
  });

  it("renders the Zeeman fan of a fine level with sublevels", () => {
    const fine = {
      n: 2, l: 1, j: 1.5,
      energy: qty(-3.4), energy_ev: qty(-3.4),
      shift: qty(0), shift_ev: qty(0),
      sublevels: [
        { m_j: 1.5, branch: "single", j_label: 1.5, high_field_label: "m_l=1, m_s=+0.5", energy: qty(-3.4), energy_ev: qty(-3.4) },
        { m_j: 0.5, branch: "upper", j_label: 1.5, high_field_label: "m_l=0, m_s=+0.5", energy: qty(-3.4), energy_ev: qty(-3.4) },
        { m_j: -0.5, branch: "lower", j_label: 0.5, high_field_label: "m_l=0, m_s=-0.5", energy: qty(-3.4), energy_ev: qty(-3.4) },
        { m_j: -1.5, branch: "single", j_label: 1.5, high_field_label: "m_l=-1, m_s=-0.5", energy: qty(-3.4), energy_ev: qty(-3.4) },
      ],
    };
    const html = renderToStaticMarkup(<ZeemanFan fine={fine} bField={2} />);
    expect(html).toContain("m_j=1.5");
    expect(html).toContain("B = 2 T");
  });
});

describe("ScreenedLadder", () => {
  const levels: ScreenedLevels = {
    system: { ...SYS },
    config: "1s2",
    is_ground: true,
    orbitals: [
      { n: 1, l: 0, label: "1s2", occupancy: 2, energy: qty(-24), energy_ev: qty(-24) },
      { n: 2, l: 0, label: "2s0", occupancy: 0, energy: qty(-1), energy_ev: qty(-1) },
    ],
    total_energy: qty(-48),
    total_energy_ev: qty(-48),
  };

  it("draws filled and virtual rungs", () => {
    const html = renderToStaticMarkup(<ScreenedLadder levels={levels} />);
    expect(html).toContain("1s2");
    expect(html).toContain("virtual");
    expect(html).toContain("ionization limit");
  });

  it("discriminates screened payloads", () => {
    expect(isScreenedLevels(levels)).toBe(true);
    const hydrogenic = {
      system: { ...SYS },
      n_max: 2,
      fine_structure: false,
      alpha: 1 / 137,
      dirac: false,
      b_field: 0,
      e_field: 0,
      hyperfine: false,
      fine: null,
      gross: [],
    };
    expect(isScreenedLevels(hydrogenic)).toBe(false);
  });
});
