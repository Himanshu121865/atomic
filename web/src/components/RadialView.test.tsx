import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Provenance, SystemInfo } from "../api/types";
import { useAppStore } from "../state/store";
import { drawCutoff, RadialPlots, RadialView, zeroCrossings } from "./RadialView";

const PROV: Provenance = {
  fidelity: "exact",
  method: "m",
  assumptions: [],
  error_estimate: null,
  refinement: null,
};

function field(values: number[]) {
  return {
    values,
    grid: values.map((_, i) => i),
    unit: "u",
    grid_unit: "bohr",
    label: "F",
    provenance: { ...PROV },
  };
}

describe("zeroCrossings", () => {
  it("finds sign changes and skips exact zeros", () => {
    expect(zeroCrossings([0, 1, 2, 3], [1, 0.5, -0.5, -1])).toHaveLength(1);
    expect(zeroCrossings([0, 1, 2], [1, 2, 3])).toHaveLength(0);
  });
});

describe("drawCutoff", () => {
  it("windows to where amplitude survives", () => {
    expect(drawCutoff([1, 0.5, 1e-4, 1e-9])).toBeLessThan(4);
    expect(drawCutoff([0, 0, 0])).toBe(3);
  });
});

describe("RadialView", () => {
  it("asks to wait with no data", () => {
    useAppStore.setState({ radial: null, stateInfo: null });
    expect(renderToStaticMarkup(<RadialView />)).toContain("Loading the radial");
  });

  it("plots both curves with node marks and the mean-radius marker", () => {
    const sys: SystemInfo = {
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
    const radial = {
      n: 2,
      l: 0,
      system: { ...sys },
      r_wavefunction: field([1, 0.5, -0.5, -1]),
      radial_probability: field([0, 0.25, 0.25, 0]),
    };
    const html = renderToStaticMarkup(
      <RadialPlots
        radial={radial}
        meanRadius={{ value: 2.5, unit: "bohr", label: "r", provenance: { ...PROV } }}
      />,
    );
    expect(html).toContain("R(r)");
    expect(html).toContain("P(r)");
    expect(html).toContain("1 radial node");
    expect(html).toContain("2.50");
  });
});
