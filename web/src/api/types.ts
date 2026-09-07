export type Fidelity =
  | "exact"
  | "numerical"
  | "approximation"
  | "counterfactual"
  | "visual_liberty";

export interface Provenance {
  fidelity: Fidelity;
  method: string;
  assumptions: string[];
  error_estimate: number | null;
  refinement: string | null;
}

export interface Quantity {
  value: number;
  unit: string;
  label: string;
  provenance: Provenance;
}

export interface FieldData {
  values: number[];
  grid: number[];
  unit: string;
  grid_unit: string;
  label: string;
  provenance: Provenance;
}

export interface SystemInfo {
  key: string;
  name: string;
  z: number;
  mu_ratio: Quantity;
  m_over_m_nucleus: number;
  description: string;
  nuclear_radius: Quantity | null;
  nuclear_radius_fm: Quantity | null;
  kind: "hydrogenic" | "screened";
  n_electrons: number | null;
  has_gsz: boolean;
}

export interface StateResponse {
  n: number;
  l: number;
  m: number;
  system: SystemInfo;
  energy: Quantity;
  energy_ev: Quantity;
  mean_radius: Quantity;
  mean_radius_pm: Quantity;
  angular_momentum: Quantity;
  radial_nodes: number;
  angular_nodes: number;
}

export interface SystemsResponse {
  systems: SystemInfo[];
}

export interface LevelEntry {
  n: number;
  energy: Quantity;
  energy_ev: Quantity;
  degeneracy: number;
}

export interface LevelsResponse {
  system: SystemInfo;
  n_max: number;
  levels: LevelEntry[];
}

export interface RadialResponse {
  n: number;
  l: number;
  system: SystemInfo;
  r_wavefunction: FieldData;
  radial_probability: FieldData;
}

export type JobStatus = "pending" | "running" | "done" | "error";

export interface JobInfo {
  id: string;
  status: JobStatus;
  progress: number;
  error: string | null;
}

export interface ChannelInfo {
  name: string;
  dtype: string;
  unit: string;
  provenance: Provenance;
}

export interface SampleMeta {
  kind: "sample";
  count: number;
  dtype: string;
  layout: string;
  unit: string;
  n: number;
  l: number;
  m: number;
  basis: string;
  system: string;
  model: string;
  provenance: Provenance;
  channels: ChannelInfo[];
}

export interface PlaneMeta {
  kind: "plane";
  resolution: number;
  dtype: string;
  layout: string;
  quantity: "density" | "psi";
  unit: string;
  label: string;
  half_extent: number;
  axis_unit: string;
  n: number;
  l: number;
  m: number;
  basis: string;
  system: string;
  model: string;
  provenance: Provenance;
}

export type JobMeta = SampleMeta | PlaneMeta;
