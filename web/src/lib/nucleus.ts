import type { SystemInfo } from "../api/types";

export type NucleusMode = "hidden" | "true-scale" | "marker";

export const NUCLEUS_MODES: { value: NucleusMode; label: string }[] = [
  { value: "marker", label: "visible marker" },
  { value: "true-scale", label: "true scale" },
  { value: "hidden", label: "hidden" },
];

export const MARKER_DIVISOR = 90;

export interface NucleusSphere {
  kind: "true-scale" | "marker";
  radius: number;
  magnification: number;
}

export function nucleusSphere(
  mode: NucleusMode,
  radiusBohr: number | null,
  cameraDistance: number,
): NucleusSphere | null {
  if (mode === "hidden" || radiusBohr === null || radiusBohr <= 0) return null;
  if (mode === "true-scale") {
    return { kind: "true-scale", radius: radiusBohr, magnification: 1 };
  }
  const radius = cameraDistance / MARKER_DIVISOR;
  return { kind: "marker", radius, magnification: radius / radiusBohr };
}

export function formatMagnification(x: number): string {
  const rounded = Number(x.toPrecision(2));
  return `${rounded.toLocaleString("en-US")}×`;
}

export function nucleusCaption(
  mode: NucleusMode,
  system: SystemInfo | null | undefined,
  sphere: NucleusSphere | null,
): string | null {
  if (mode === "hidden" || !system) return null;
  if (system.nuclear_radius === null || system.nuclear_radius_fm === null) {
    return "the “nucleus” here is a point lepton, so there is no measured size to draw";
  }
  const fm = system.nuclear_radius_fm.value.toFixed(3);
  const bohr = system.nuclear_radius.value.toExponential(1).replace("e-", "e-");
  if (mode === "true-scale") {
    return (
      `nucleus at true scale: r_rms = ${fm} fm (${bohr} a₀), ` +
      "smaller than a pixel at this zoom; nothing is being hidden, that IS the physics"
    );
  }
  if (!sphere) return null;
  return `the nucleus marker is drawn ${formatMagnification(sphere.magnification)} true size`;
}
