import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "./store";

const SYSTEM = {
  key: "h",
  name: "Hydrogen",
  z: 1,
  mu_ratio: { value: 1, unit: "m_e", label: "m", provenance: null },
  m_over_m_nucleus: 0,
  description: "h",
  nuclear_radius: null,
  nuclear_radius_fm: null,
  kind: "hydrogenic",
  n_electrons: null,
  has_gsz: true,
};

const SAMPLE_META = {
  kind: "sample",
  count: 2,
  dtype: "float32",
  layout: "xyz-interleaved",
  unit: "bohr",
  n: 1,
  l: 0,
  m: 0,
  basis: "complex",
  system: "h",
  model: "hydrogenic",
  provenance: null,
  channels: [
    { name: "positions", dtype: "float32", unit: "bohr", provenance: null },
    { name: "density", dtype: "float32", unit: "bohr^-3", provenance: null },
    { name: "phase", dtype: "float32", unit: "rad", provenance: null },
  ],
};

const PLANE_META = {
  kind: "plane",
  resolution: 4,
  dtype: "float32",
  layout: "row-major",
  quantity: "density",
  unit: "bohr^-3",
  label: "density",
  half_extent: 10,
  axis_unit: "bohr",
  n: 1,
  l: 0,
  m: 0,
  basis: "complex",
  system: "h",
  model: "hydrogenic",
  provenance: null,
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    async (url: string, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      if (url === "/api/systems") return json({ systems: [SYSTEM] });
      if (url.startsWith("/api/state/")) {
        return json({ n: 1, l: 0, m: 0, system: SYSTEM, energy: { value: -0.5 } });
      }
      if (url.startsWith("/api/levels")) {
        return json({ system: SYSTEM, n_max: 6, levels: [] });
      }
      if (url.startsWith("/api/radial/")) {
        return json({ n: 1, l: 0, system: SYSTEM });
      }
      if (url === "/api/jobs/sample" && method === "POST") {
        return json({ id: "j1", status: "pending", progress: 0, error: null });
      }
      if (url === "/api/jobs/plane" && method === "POST") {
        return json({ id: "p1", status: "pending", progress: 0, error: null });
      }
      if (url === "/api/jobs/j1/meta") return json(SAMPLE_META);
      if (url === "/api/jobs/p1/meta") return json(PLANE_META);
      if (url.startsWith("/api/jobs/j1/data")) {
        if (url.includes("density") || url.includes("phase")) return bytes(8);
        return bytes(24);
      }
      if (url.startsWith("/api/jobs/p1/data")) return bytes(64);
      throw new Error(`unstubbed ${method} ${url}`);
    },
  );
}

function json(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function bytes(n: number) {
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(n) } as Response;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  stubFetch();
  useAppStore.getState().setQuantumNumbers(1, 0, 0);
  useAppStore.getState().setSystem("h");
  useAppStore.getState().setView("cloud");
});

describe("loaders", () => {
  it("loads systems, state, radial and levels", async () => {
    const s = useAppStore.getState();
    await s.loadSystems();
    expect(useAppStore.getState().systems.map((x) => x.key)).toEqual(["h"]);
    await s.loadStateInfo();
    expect(useAppStore.getState().stateInfo?.energy.value).toBe(-0.5);
    await s.loadRadial();
    expect(useAppStore.getState().radial?.n).toBe(1);
    await s.loadLevels();
    expect(useAppStore.getState().levels?.n_max).toBe(6);
  });

  it("samples a cloud through the job lifecycle", async () => {
    await useAppStore.getState().sample();
    const s = useAppStore.getState();
    expect(s.status).toBe("ready");
    expect(s.positions).toHaveLength(6);
    expect(s.density).toHaveLength(2);
    expect(s.phase).toHaveLength(2);
    expect(s.meta?.count).toBe(2);
  });

  it("loads a plane grid", async () => {
    await useAppStore.getState().loadPlane();
    const s = useAppStore.getState();
    expect(s.planeStatus).toBe("ready");
    expect(s.plane?.values).toHaveLength(16);
    expect(s.plane?.meta.resolution).toBe(4);
  });

  it("quantum changes invalidate derived data", async () => {
    await useAppStore.getState().sample();
    expect(useAppStore.getState().status).toBe("ready");
    useAppStore.getState().setQuantumNumbers(2, 1, 0);
    const s = useAppStore.getState();
    expect(s.positions).toBeNull();
    expect(s.meta).toBeNull();
    expect(s.status).toBe("idle");
    expect(s.n).toBe(2);
  });

  it("records engine failures instead of throwing", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("down");
    });
    await useAppStore.getState().sample();
    const s = useAppStore.getState();
    expect(s.status).toBe("error");
    expect(s.error).toContain("down");
  });
});
