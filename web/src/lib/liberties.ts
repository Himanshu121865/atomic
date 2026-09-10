import type { Provenance } from "../api/types";
import { MARKER_DIVISOR } from "./nucleus";

export function formatErrorScale(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return "0";
  return Math.abs(x) < 1e-3 ? x.toExponential(1) : x.toPrecision(2);
}

export const RENDER_LIBERTIES: Provenance = {
  fidelity: "visual_liberty",
  method: "engine-sampled positions rendered as three.js point sprites",
  assumptions: [
    "the z quantization axis is drawn screen-vertical (the data stays xyz in bohr)",
    "point size, opacity and additive glow are presentation, not physics",
    "density colour brightness is gamma-compressed: t = (rho/rho_max)^0.5",
  ],
  error_estimate: null,
  refinement: "the positions, density and phase channels come from the engine unmodified",
};

export const NUCLEUS_MARKER_LIBERTY: Provenance = {
  fidelity: "visual_liberty",
  method: "the nucleus is drawn as a fixed-size marker sphere at the origin",
  assumptions: [
    `the marker radius is camera distance / ${MARKER_DIVISOR}, which is presentation, not physics`,
    "the true position (the origin) and the r_rms in the readout are exact",
    "switch to 'true scale' for the honest, subpixel size",
  ],
  error_estimate: null,
  refinement: "the magnification factor is stated live in the canvas caption",
};

export const GHOST_DISPLAY_WINDINGS = 16;

export const CLASSICAL_SLOWMO: Provenance = {
  fidelity: "visual_liberty",
  method: "the classical collapse plays in slow motion; the live clock shows real simulated time",
  assumptions: [
    "the playback speed is a viewing choice, not physics",
    `the spiral is drawn with at most ${GHOST_DISPLAY_WINDINGS} windings; the honest revolution count is in the orbits readout`,
  ],
  error_estimate: null,
  refinement: "the slow-motion factor is stated live in the ghost HUD",
};

export const PROFILE_DECADES = 6;

export const SPECTRUM_PROFILE_LIBERTY: Provenance = {
  fidelity: "visual_liberty",
  method: `the full-range profile is drawn on log10 intensity, clipped ${PROFILE_DECADES} decades below the peak`,
  assumptions: [
    "the curve itself is synthesized in the engine: Voigt profiles at engine widths",
    `anything fainter than 1e-${PROFILE_DECADES} of the peak is drawn at the floor, not at zero`,
    "the log compression is a reading aid; zoom a line and it is plotted linearly",
    "the wavelength axis is logarithmic, so a line's drawn width is not its shape",
  ],
  error_estimate: null,
  refinement: "the zoomed panel plots intensity linearly on a linear wavelength axis",
};

export const SPECTRUM_INTENSITY_LIBERTY: Provenance = {
  fidelity: "visual_liberty",
  method: "bar height and opacity scale with log10 of the Einstein A coefficient",
  assumptions: [
    "A (the spontaneous emission rate, s^-1) is computed in the engine, exact to quadrature roundoff",
    "bar height and opacity are a log-compressed rate, NOT a predicted observed intensity",
    "no level populations are modelled here: turn on LTE weighting for those",
    "the log compression is presentation; the decade range is printed in the caption",
  ],
  error_estimate: null,
  refinement: "LTE weighting (the temperature and density controls) turns these rates into emissivities",
};

export const SPECTRUM_EMISSIVITY_LIBERTY: Provenance = {
  fidelity: "visual_liberty",
  method: "bar height and opacity scale with log10 of the LTE emissivity",
  assumptions: [
    "the emissivity (eV/s per atom) is computed in the engine from Boltzmann populations and Saha ionization",
    "an emissivity is still not an observed brightness: the model is optically thin",
    "the log compression is presentation; the decade range is printed in the caption",
    "lines too faint to reach the floor of the scale are drawn at the floor rather than dropped",
  ],
  error_estimate: null,
  refinement: "radiative transfer through a finite optical depth would give a predicted brightness",
};

export const HF_LADDER_AXIS_LIBERTY: Provenance = {
  fidelity: "visual_liberty",
  method: "the orbital ladder is drawn on log10 of binding energy |ε| [eV], deepest at the bottom",
  assumptions: [
    "the energies themselves are engine values, left unmodified; only the axis is compressed",
    "spacing on this axis is a ratio, not a difference: two rungs one decade apart differ 10x",
    "0 eV (the ionization limit) is off the top of a logarithmic axis, not at the top rung",
    "every occupied orbital is bound, so |ε| never crosses zero and the log is always defined",
  ],
  error_estimate: null,
  refinement: "every rung prints its eV value beside it, on the linear scale it was computed on",
};

export const ISOSURFACE_LIBERTY: Provenance = {
  fidelity: "visual_liberty",
  method: "a three.js mesh of engine-extracted triangles, lit, smooth-shaded and translucent",
  assumptions: [
    "vertex normals are averaged across facets, smoothing away the faceting a finite grid really has",
    "the lighting and translucency are presentation; the geometry is the engine's, unmodified",
    "a solid-looking shell is not an edge; the enclosed fraction printed beside it is the whole claim",
    "each vertex is coloured by arg(psi) through the same map the point cloud uses",
  ],
  error_estimate: null,
  refinement: "the enclosed fraction, its grid-halving error and the escaped mass are printed live",
};

export const THUMBNAIL_LIBERTY: Provenance = {
  fidelity: "visual_liberty",
  method: "an inferno PNG of |psi|^2 on the y=0 plane, rendered server-side as a navigation aid",
  assumptions: [
    "the brightness is gamma-compressed: t = (rho/rho_max)^0.5",
    "this is not a measurement surface: it carries no axes and no scale",
  ],
  error_estimate: null,
  refinement: "the 2D cross-section view shows the same plane labelled and to scale",
};
