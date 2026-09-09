import type {
  ClassicalGhost,
  ConstantsReport,
  ForceLawResult,
  JobInfo,
  JobMeta,
  LevelsResponse,
  RadialResponse,
  ScreenedLevels,
  StateResponse,
  SystemsResponse,
} from "./types";

export function isScreenedLevels(
  body: LevelsResponse | ScreenedLevels,
): body is ScreenedLevels {
  return "orbitals" in body;
}

export type Basis = "complex" | "real";
export type PlaneQuantity = "density" | "psi";

export function num(v: number): string {
  return encodeURIComponent(String(v));
}

export function key(v: string): string {
  return encodeURIComponent(v);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function errorFrom(url: string, res: Response): Promise<Error> {
  let detail: string | null = null;
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    detail = null;
  }
  return new Error(detail ?? `${url}: HTTP ${res.status}`);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(url, res);
  return res.json() as Promise<T>;
}

export function getSystems(): Promise<SystemsResponse> {
  return getJson("/api/systems");
}

export function getState(
  n: number,
  l: number,
  m: number,
  system: string,
): Promise<StateResponse> {
  return getJson(`/api/state/${n}/${l}/${m}?system=${key(system)}`);
}

export function getRadial(
  n: number,
  l: number,
  system: string,
  points?: number,
): Promise<RadialResponse> {
  const p = points === undefined ? "" : `&points=${points}`;
  return getJson(`/api/radial/${n}/${l}?system=${key(system)}${p}`);
}

export function getLevels(system: string, nMax: number): Promise<LevelsResponse | ScreenedLevels> {
  return getJson(`/api/levels?system=${key(system)}&n_max=${nMax}`);
}

export interface ConstMultipliers {
  hbar: number;
  e: number;
  m_e: number;
  eps0: number;
  c: number;
}

export function getConstants(m: ConstMultipliers): Promise<ConstantsReport> {
  return getJson(
    `/api/constants?hbar=${m.hbar}&e=${m.e}&m_e=${m.m_e}&eps0=${m.eps0}&c=${m.c}`,
  );
}

export function getClassical(system: string, n: number): Promise<ClassicalGhost> {
  return getJson(`/api/classical?system=${key(system)}&n=${n}`);
}

export interface ForceLawParams {
  system: string;
  preset: string;
  params: Record<string, number>;
  l: number;
  nStates?: number;
  expr?: string;
}

export function getForceLaw(p: ForceLawParams): Promise<ForceLawResult> {
  const q = new URLSearchParams({
    system: p.system,
    preset: p.preset,
    l: String(p.l),
    n_states: String(p.nStates ?? 4),
  });
  for (const [k, v] of Object.entries(p.params)) q.set(k, String(v));
  if (p.expr !== undefined) q.set("expr", p.expr);
  return getJson(`/api/forcelaw?${q.toString()}`);
}

export interface SampleParams {
  n: number;
  l: number;
  m: number;
  count: number;
  seed?: number;
  basis: Basis;
  system: string;
}

export function createSampleJob(params: SampleParams): Promise<JobInfo> {
  return postJson("/api/jobs/sample", { seed: 0, ...params });
}

export interface PlaneParams {
  n: number;
  l: number;
  m: number;
  quantity: PlaneQuantity;
  basis: Basis;
  system: string;
  resolution?: number;
}

export function createPlaneJob(params: PlaneParams): Promise<JobInfo> {
  return postJson("/api/jobs/plane", { resolution: 256, ...params });
}

export function watchJob(jobId: string, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/jobs/${jobId}`);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as {
        status: string;
        progress: number;
        error: string | null;
      };
      onProgress(msg.progress);
      if (msg.status === "done") {
        ws.close();
        resolve();
      } else if (msg.status === "error") {
        ws.close();
        reject(new Error(msg.error ?? "job failed"));
      }
    };
    ws.onerror = () => reject(new Error("websocket error"));
  });
}

export function getJobMeta(jobId: string): Promise<JobMeta> {
  return getJson(`/api/jobs/${jobId}/meta`);
}

export async function getChannel(jobId: string, channel?: string): Promise<Float32Array> {
  const url = channel
    ? `/api/jobs/${jobId}/data?channel=${channel}`
    : `/api/jobs/${jobId}/data`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return decodeFloats(await res.arrayBuffer());
}

export function decodeFloats(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength % 4 !== 0) {
    throw new Error(`byte length ${buffer.byteLength} is not a multiple of 4 (float32)`);
  }
  return new Float32Array(buffer);
}

export function decodePositions(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength % 12 !== 0) {
    throw new Error(
      `positions byte length ${buffer.byteLength} is not a multiple of 12 (xyz float32)`,
    );
  }
  return new Float32Array(buffer);
}
