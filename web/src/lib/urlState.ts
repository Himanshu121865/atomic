import type { Basis, ConstMultipliers, PlaneQuantity } from "../api/client";
import { clampState } from "./quantum";
import {
  DEFAULT_EXPR,
  PRESET_PARAMS,
  clampParam,
  defaultParams,
  validateExprClient,
  type ForcePreset,
} from "./forceLaw";
import { CONST_MAX, CONST_MIN, CONSTANT_KEYS, type ConstantKey } from "./whatif";

export type ViewMode = "cloud" | "plane" | "radial" | "levels" | "whatif" | "forcelaw";
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
  labConst: ConstMultipliers;
  forcePreset: ForcePreset;
  forceParams: Record<string, number>;
  forceL: number;
  forceExpr: string;
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
  labConst: { hbar: 1, e: 1, m_e: 1, eps0: 1, c: 1 },
  forcePreset: "powerlaw",
  forceParams: defaultParams("powerlaw"),
  forceL: 0,
  forceExpr: DEFAULT_EXPR,
};

const N_MAX_UI = 6;

const VIEWS: ViewMode[] = ["cloud", "plane", "radial", "levels", "whatif", "forcelaw"];
const COLORS: ColorMode[] = ["solid", "density", "phase"];
const BASES: Basis[] = ["complex", "real"];
const PLANES: PlaneQuantity[] = ["density", "psi"];
const SYSTEM_KEY = /^[a-z0-9+-]{1,16}$/;
const FORCE_PRESETS: ForcePreset[] = [
  "powerlaw",
  "yukawa",
  "harmonic",
  "finitewell",
  "coulombcore",
  "custom",
];

const CONST_PARAMS: Record<ConstantKey, string> = {
  hbar: "hbar",
  e: "e",
  m_e: "me",
  eps0: "eps0",
  c: "c",
};

function pickEnum<T extends string>(raw: string | null, allowed: T[]): T | undefined {
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

function pickInt(raw: string | null): number | undefined {
  if (raw === null || !/^-?\d+$/.test(raw)) return undefined;
  return Number(raw);
}

function pickFloat(raw: string | null): number | undefined {
  if (raw === null || !/^-?\d*\.?\d+(e-?\d+)?$/i.test(raw)) return undefined;
  const v = Number(raw);
  return Number.isFinite(v) ? v : undefined;
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
    labConst: s.labConst,
    forcePreset: s.forcePreset,
    forceParams: s.forceParams,
    forceL: s.forceL,
    forceExpr: s.forceExpr,
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

  const lc: Partial<ConstMultipliers> = {};
  for (const k of CONSTANT_KEYS) {
    const v = pickFloat(q.get(CONST_PARAMS[k]));
    if (v !== undefined && v > 0) lc[k] = Math.min(Math.max(v, CONST_MIN), CONST_MAX);
  }
  if (Object.keys(lc).length > 0) out.labConst = { ...URL_DEFAULTS.labConst, ...lc };

  const presetRaw = q.get("preset");
  const preset = pickEnum(presetRaw, FORCE_PRESETS) ?? "powerlaw";
  const params = defaultParams(preset);
  let sawForceParam = false;
  for (const spec of PRESET_PARAMS[preset]) {
    const v = pickFloat(q.get(spec.name));
    if (v !== undefined) {
      params[spec.name] = clampParam(spec, v);
      sawForceParam = true;
    }
  }
  if ((presetRaw !== null && pickEnum(presetRaw, FORCE_PRESETS) !== undefined) || sawForceParam) {
    out.forcePreset = preset;
    out.forceParams = params;
  }

  const fl = pickInt(q.get("fl"));
  if (fl !== undefined && fl >= 0) out.forceL = fl;

  if (out.forcePreset === "custom") {
    const rawExpr = q.get("expr");
    if (rawExpr !== null && validateExprClient(rawExpr) === null) out.forceExpr = rawExpr;
  }

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
  for (const k of CONSTANT_KEYS) {
    if (Math.abs(state.labConst[k] - URL_DEFAULTS.labConst[k]) > 1e-9) {
      q.set(CONST_PARAMS[k], String(state.labConst[k]));
    }
  }
  if (state.forcePreset !== URL_DEFAULTS.forcePreset) q.set("preset", state.forcePreset);
  for (const spec of PRESET_PARAMS[state.forcePreset]) {
    const v = state.forceParams[spec.name];
    if (v !== undefined && Math.abs(v - spec.default) > 1e-9) q.set(spec.name, String(v));
  }
  if (state.forceL !== URL_DEFAULTS.forceL) q.set("fl", String(state.forceL));
  if (state.forcePreset === "custom" && state.forceExpr !== URL_DEFAULTS.forceExpr) {
    q.set("expr", state.forceExpr);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
