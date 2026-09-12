import type { UrlState } from "../lib/urlState";

export const CLAIM_KINDS = ["energy_eV", "mean_r_pm", "wavelength_nm", "ionization_eV"] as const;

export type ClaimKind = (typeof CLAIM_KINDS)[number];

export interface Claim {
  of: ClaimKind;
  is: number;
  tol: number;
  system?: string;
  n?: number;
  l?: number;
  model?: "gsz" | "hf";
  fineStructure?: boolean;
  dirac?: boolean;
  exchange?: boolean;
  pauli?: boolean;
  n_upper?: number;
  n_lower?: number;
}

export interface TourStep {
  id: string;
  title: string;
  body: string[];
  state: Partial<UrlState>;
  spotlight?: string;
  claims?: Claim[];
}

export interface Tour {
  id: string;
  title: string;
  blurb: string;
  steps: TourStep[];
}
