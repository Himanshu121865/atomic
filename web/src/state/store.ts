import { create } from "zustand";
import {
  createPlaneJob,
  createSampleJob,
  getAbsorption,
  getChannel,
  getClassical,
  getConstants,
  getCurveOfGrowth,
  getForceLaw,
  getJobMeta,
  getLevels,
  getRadial,
  getSpectrum,
  getState,
  getSystems,
  type Basis,
  type ConstMultipliers,
  type PlaneQuantity,
} from "../api/client";
import type {
  AbsorptionInfo,
  ClassicalGhost,
  ConstantsReport,
  CurveOfGrowthInfo,
  ForceLawResult,
  JobMeta,
  LevelsResponse,
  PlaneMeta,
  RadialResponse,
  SampleMeta,
  ScreenedLevels,
  SpectrumResponse,
  StateResponse,
  SystemInfo,
} from "../api/types";
import type { ForcePreset } from "../lib/forceLaw";
import { DEFAULT_EXPR, defaultParams } from "../lib/forceLaw";
import type { AtomModel, ColorMode, ViewMode } from "../lib/urlState";
import { resolveModel } from "../lib/hfModel";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface PlaneData {
  meta: PlaneMeta;
  values: Float32Array;
}

interface AppState {
  n: number;
  l: number;
  m: number;
  system: string;
  basis: Basis;
  view: ViewMode;
  colorMode: ColorMode;
  planeQuantity: PlaneQuantity;
  count: number;
  systems: SystemInfo[];
  stateInfo: StateResponse | null;
  positions: Float32Array | null;
  density: Float32Array | null;
  phase: Float32Array | null;
  meta: SampleMeta | null;
  status: LoadStatus;
  progress: number;
  error: string | null;
  plane: PlaneData | null;
  planeStatus: LoadStatus;
  radial: RadialResponse | null;
  levels: LevelsResponse | ScreenedLevels | null;
  spectrum: SpectrumResponse | null;
  intensities: boolean;
  thermal: boolean;
  temperatureK: number;
  logNe: number;
  profile: boolean;
  logResolvingPower: number | null;
  profileZoom: [number, number] | null;
  showCurveOfGrowth: boolean;
  curveOfGrowth: CurveOfGrowthInfo | null;
  absorption: boolean;
  logColumn: number;
  absorptionData: AbsorptionInfo | null;
  labConst: ConstMultipliers;
  whatif: ConstantsReport | null;
  whatifStatus: LoadStatus;
  ghost: ClassicalGhost | null;
  ghostStatus: LoadStatus;
  forcePreset: ForcePreset;
  forceParams: Record<string, number>;
  forceL: number;
  forceExpr: string;
  forceLaw: ForceLawResult | null;
  forceStatus: LoadStatus;
  fineStructure: boolean;
  dirac: boolean;
  bField: number;
  eField: number;
  hyperfine: boolean;
  model: AtomModel;
  setModel: (model: AtomModel) => void;
  setQuantumNumbers: (n: number, l: number, m: number) => void;
  setSystem: (system: string) => void;
  setBasis: (basis: Basis) => void;
  setView: (view: ViewMode) => void;
  setColorMode: (colorMode: ColorMode) => void;
  setPlaneQuantity: (planeQuantity: PlaneQuantity) => void;
  setCount: (count: number) => void;
  loadSystems: () => Promise<void>;
  loadStateInfo: () => Promise<void>;
  sample: () => Promise<void>;
  loadPlane: () => Promise<void>;
  loadRadial: () => Promise<void>;
  loadLevels: () => Promise<void>;
  loadSpectrum: () => Promise<void>;
  setIntensities: (intensities: boolean) => void;
  setThermal: (thermal: boolean) => void;
  setTemperatureK: (temperatureK: number) => void;
  setLogNe: (logNe: number) => void;
  setProfile: (profile: boolean) => void;
  setLogResolvingPower: (logResolvingPower: number | null) => void;
  setProfileZoom: (profileZoom: [number, number] | null) => void;
  setShowCurveOfGrowth: (showCurveOfGrowth: boolean) => void;
  loadCurveOfGrowth: (lambdaNm: number) => Promise<void>;
  setAbsorption: (absorption: boolean) => void;
  setLogColumn: (logColumn: number) => void;
  loadAbsorption: () => Promise<void>;
  setLabConst: (partial: Partial<ConstMultipliers>) => void;
  loadWhatIf: () => Promise<void>;
  loadGhost: () => Promise<void>;
  setForcePreset: (preset: ForcePreset) => void;
  setForceParam: (name: string, value: number) => void;
  setForceL: (l: number) => void;
  setForceExpr: (expr: string) => void;
  loadForceLaw: () => Promise<void>;
  setFineStructure: (on: boolean) => void;
  setDirac: (on: boolean) => void;
  setBField: (b: number) => void;
  setEField: (e: number) => void;
  setHyperfine: (on: boolean) => void;
}

const INVALIDATED = {
  stateInfo: null,
  positions: null,
  density: null,
  phase: null,
  meta: null,
  status: "idle",
  progress: 0,
  error: null,
  plane: null,
  planeStatus: "idle",
  radial: null,
  levels: null,
  spectrum: null,
  curveOfGrowth: null,
  absorptionData: null,
  profileZoom: null as [number, number] | null,
  ghost: null,
  ghostStatus: "idle",
} as const;

let seedCounter = 1;

async function waitMeta(jobId: string, timeoutMs = 30000): Promise<JobMeta> {
  const start = Date.now();
  for (;;) {
    try {
      return await getJobMeta(jobId);
    } catch {
      if (Date.now() - start > timeoutMs) throw new Error("job timed out");
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useAppStore = create<AppState>()((set, get) => ({
  n: 1,
  l: 0,
  m: 0,
  system: "h",
  basis: "complex",
  view: "cloud",
  colorMode: "solid",
  planeQuantity: "density",
  count: 100000,
  systems: [],
  stateInfo: null,
  positions: null,
  density: null,
  phase: null,
  meta: null,
  status: "idle",
  progress: 0,
  error: null,
  plane: null,
  planeStatus: "idle",
  radial: null,
  levels: null,
  spectrum: null,
  intensities: true,
  model: "gsz",
  curveOfGrowth: null,
  absorptionData: null,
  temperatureK: 10000,
  logNe: 13,
  logResolvingPower: null,
  profileZoom: null,
  thermal: false,
  profile: false,
  showCurveOfGrowth: false,
  absorption: false,
  logColumn: 20,
  labConst: { hbar: 1, e: 1, m_e: 1, eps0: 1, c: 1 },
  whatif: null,
  whatifStatus: "idle",
  ghost: null,
  ghostStatus: "idle",
  forcePreset: "powerlaw",
  forceParams: defaultParams("powerlaw"),
  forceL: 0,
  forceExpr: DEFAULT_EXPR,
  forceLaw: null,
  forceStatus: "idle",
  fineStructure: false,
  dirac: false,
  bField: 0,
  eField: 0,
  hyperfine: false,

  setQuantumNumbers: (n, l, m) => set({ n, l, m, ...INVALIDATED }),
  setSystem: (system) =>
    set({
      system,
      ...INVALIDATED,
      model: resolveModel(get().systems, system, get().model),
    }),
  setBasis: (basis) => set({ basis, ...INVALIDATED }),
  setView: (view) => set({ view }),
  setColorMode: (colorMode) => set({ colorMode }),
  setPlaneQuantity: (planeQuantity) => set({ planeQuantity, plane: null, planeStatus: "idle" }),
  setCount: (count) => set({ count }),

  loadSystems: async () => {
    const systems = (await getSystems()).systems;
    set({ systems, model: resolveModel(systems, get().system, get().model) });
  },

  loadStateInfo: async () => {
    const s = get();
    try {
      set({ stateInfo: await getState(s.n, s.l, s.m, s.system) });
    } catch {
      set({ stateInfo: null });
    }
  },

  sample: async () => {
    const s = get();
    set({ status: "loading", progress: 0, error: null });
    try {
      const job = await createSampleJob({
        n: s.n,
        l: s.l,
        m: s.m,
        count: s.count,
        seed: seedCounter++ % 1000000,
        basis: s.basis,
        system: s.system,
      });
      const meta = await waitMeta(job.id);
      if (meta.kind !== "sample") throw new Error(`unexpected job kind ${(meta as JobMeta).kind}`);
      const positions = await getChannel(job.id);
      const density = await getChannel(job.id, "density");
      const phase = meta.channels.some((c) => c.name === "phase")
        ? await getChannel(job.id, "phase")
        : null;
      set({ positions, density, phase, meta, status: "ready", progress: 1 });
    } catch (e) {
      set({ status: "error", error: message(e) });
    }
  },

  loadPlane: async () => {
    const s = get();
    set({ planeStatus: "loading" });
    try {
      const job = await createPlaneJob({
        n: s.n,
        l: s.l,
        m: s.m,
        quantity: s.planeQuantity,
        basis: s.basis,
        system: s.system,
        resolution: 256,
      });
      const meta = await waitMeta(job.id);
      if (meta.kind !== "plane") throw new Error(`unexpected job kind ${(meta as JobMeta).kind}`);
      const values = await getChannel(job.id);
      set({ plane: { meta, values }, planeStatus: "ready" });
    } catch {
      set({ planeStatus: "error" });
    }
  },

  loadRadial: async () => {
    const s = get();
    set({ radial: await getRadial(s.n, s.l, s.system, 400) });
  },

  loadLevels: async () => {
    const s = get();
    set({
      levels: await getLevels(
        s.system,
        6,
        s.fineStructure,
        undefined,
        s.dirac,
        s.bField,
        s.eField,
        s.hyperfine,
      ),
    });
  },

  loadSpectrum: async () => {
    const s = get();
    set({
      spectrum: await getSpectrum(
        s.system, 6, s.fineStructure, s.intensities,
        s.thermal ? { temperatureK: s.temperatureK, electronDensityCm3: 10 ** s.logNe } : null,
        {
          on: s.profile,
          resolvingPower: s.logResolvingPower === null ? null : 10 ** s.logResolvingPower,
          window: s.profileZoom,
        },
      ),
    });
  },

  setIntensities: (intensities) => set({ intensities, spectrum: null }),
  setThermal: (thermal) => set({ thermal, spectrum: null }),
  setTemperatureK: (temperatureK) => set({ temperatureK, spectrum: null }),
  setLogNe: (logNe) => set({ logNe, spectrum: null }),
  setProfile: (profile) => set({ profile, spectrum: null }),
  setLogResolvingPower: (logResolvingPower) => set({ logResolvingPower, spectrum: null }),
  setProfileZoom: (profileZoom) =>
    set({ profileZoom, spectrum: null, curveOfGrowth: null, absorptionData: null }),
  setShowCurveOfGrowth: (showCurveOfGrowth) => set({ showCurveOfGrowth }),
  setAbsorption: (absorption) => set({ absorption, absorptionData: null }),
  setLogColumn: (logColumn) => set({ logColumn, absorptionData: null }),

  setFineStructure: (fineStructure) => set({ fineStructure, dirac: false, levels: null }),
  setDirac: (dirac) => set({ dirac, levels: null }),
  setBField: (bField) => set({ bField, levels: null }),
  setEField: (eField) => set({ eField, levels: null }),
  setHyperfine: (hyperfine) => set({ hyperfine, levels: null }),
  setModel: (model) => set({ model, ...INVALIDATED }),

  setLabConst: (partial) => {
    const labConst = { ...get().labConst, ...partial };
    set({ labConst, whatif: null, whatifStatus: "idle" });
  },

  loadWhatIf: async () => {
    const s = get();
    set({ whatifStatus: "loading" });
    try {
      set({ whatif: await getConstants(s.labConst), whatifStatus: "ready" });
    } catch {
      set({ whatifStatus: "error" });
    }
  },

  loadGhost: async () => {
    const s = get();
    set({ ghostStatus: "loading" });
    try {
      set({ ghost: await getClassical(s.system, s.n), ghostStatus: "ready" });
    } catch {
      set({ ghostStatus: "error" });
    }
  },

  setForcePreset: (forcePreset) =>
    set({ forcePreset, forceParams: defaultParams(forcePreset), forceLaw: null, forceStatus: "idle" }),
  setForceParam: (name, value) =>
    set((s) => ({ forceParams: { ...s.forceParams, [name]: value } })),
  setForceL: (forceL) => set({ forceL }),
  setForceExpr: (forceExpr) => set({ forceExpr }),

  loadForceLaw: async () => {
    const s = get();
    set({ forceStatus: "loading" });
    try {
      const forceLaw = await getForceLaw({
        system: s.system,
        preset: s.forcePreset,
        params: s.forceParams,
        l: s.forceL,
        expr: s.forcePreset === "custom" ? s.forceExpr : undefined,
      });
      set({ forceLaw, forceStatus: "ready" });
    } catch {
      set({ forceStatus: "error" });
    }
  },

  loadCurveOfGrowth: async (lambdaNm) => {
    const { system, fineStructure, temperatureK, logNe, logResolvingPower } = get();
    set({
      curveOfGrowth: await getCurveOfGrowth({
        system,
        nMax: 6,
        fineStructure,
        lambdaNm,
        thermal: { temperatureK, electronDensityCm3: 10 ** logNe },
        resolvingPower: logResolvingPower === null ? null : 10 ** logResolvingPower,
      }),
    });
  },

  loadAbsorption: async () => {
    const {
      system, fineStructure, temperatureK, logNe, logResolvingPower,
      logColumn, profileZoom,
    } = get();
    set({
      absorptionData: await getAbsorption({
        system,
        nMax: 6,
        fineStructure,
        columnDensityM2: 10 ** logColumn,
        thermal: { temperatureK, electronDensityCm3: 10 ** logNe },
        resolvingPower: logResolvingPower === null ? null : 10 ** logResolvingPower,
        window: profileZoom,
      }),
    });
  },
}));
