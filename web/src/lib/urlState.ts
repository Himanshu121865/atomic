import type { Basis, PlaneQuantity } from "../api/client";
import { clampState } from "./quantum";

export type ViewMode = "cloud" | "plane" | "radial" | "levels";
export type ColorMode = "solid" | "density" | "phase";

export interface UrlState {
  n: number;
  l: number;
  m: number;
  system: string;
  basis: Basis;
  view: ViewMode;
  colorMode: ColorMode;
  planeQuantity: PlaneQuantity;
}

export const URL_DEFAULTS: UrlState = {
  n: 1,
  l: 0,
  m: 0,
  system: "h",
  basis: "complex",
  view: "cloud",
  colorMode: "solid",
  planeQuantity: "density",
};

const N_MAX_UI = 6;

const VIEWS: ViewMode[] = ["cloud", "plane", "radial", "levels"];
const COLORS: ColorMode[] = ["solid", "density", "phase"];
const BASES: Basis[] = ["complex", "real"];
const PLANES: PlaneQuantity[] = ["density", "psi"];
const SYSTEM_KEY = /^[a-z0-9+-]{1,16}$/;

function pickEnum<T extends string>(raw: string | null, allowed: T[]): T | undefined {
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

function pickInt(raw: string | null): number | undefined {
  if (raw === null || !/^-?\d+$/.test(raw)) return undefined;
  return Number(raw);
}

export function currentUrlState(s: UrlState): UrlState {
  return {
    n: s.n,
    l: s.l,
    m: s.m,
    system: s.system,
    basis: s.basis,
    view: s.view,
    colorMode: s.colorMode,
    planeQuantity: s.planeQuantity,
  };
}

export function parseAppUrl(search: string): Partial<UrlState> {
  const q = new URLSearchParams(search);
  const out: Partial<UrlState> = {};

  const n = pickInt(q.get("n"));
  const l = pickInt(q.get("l"));
  const m = pickInt(q.get("m"));
  if (n !== undefined || l !== undefined || m !== undefined) {
    const clamped = clampState(
      Math.min(n ?? URL_DEFAULTS.n, N_MAX_UI),
      l ?? URL_DEFAULTS.l,
      m ?? URL_DEFAULTS.m,
    );
    out.n = clamped.n;
    out.l = clamped.l;
    out.m = clamped.m;
  }

  const system = q.get("system");
  if (system !== null && SYSTEM_KEY.test(system)) out.system = system;

  const basis = pickEnum(q.get("basis"), BASES);
  if (basis) out.basis = basis;
  const view = pickEnum(q.get("view"), VIEWS);
  if (view) out.view = view;
  let color = pickEnum(q.get("color"), COLORS);
  if (color === "phase" && (basis ?? URL_DEFAULTS.basis) === "real") color = "density";
  if (color) out.colorMode = color;
  const plane = pickEnum(q.get("plane"), PLANES);
  if (plane) out.planeQuantity = plane;

  return out;
}

export function serializeAppUrl(state: UrlState): string {
  const q = new URLSearchParams();
  if (state.n !== URL_DEFAULTS.n) q.set("n", String(state.n));
  if (state.l !== URL_DEFAULTS.l) q.set("l", String(state.l));
  if (state.m !== URL_DEFAULTS.m) q.set("m", String(state.m));
  if (state.system !== URL_DEFAULTS.system) q.set("system", state.system);
  if (state.basis !== URL_DEFAULTS.basis) q.set("basis", state.basis);
  if (state.view !== URL_DEFAULTS.view) q.set("view", state.view);
  if (state.colorMode !== URL_DEFAULTS.colorMode) q.set("color", state.colorMode);
  if (state.planeQuantity !== URL_DEFAULTS.planeQuantity) q.set("plane", state.planeQuantity);
  const s = q.toString();
  return s ? `?${s}` : "";
}
