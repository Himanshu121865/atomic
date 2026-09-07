import { clampState } from "../lib/quantum";
import type { Basis, PlaneQuantity } from "../api/client";
import type { ColorMode, ViewMode } from "../lib/urlState";
import { useAppStore } from "../state/store";
import { Choice, ControlGroup, Select, Slider } from "./Field";

const PRESET_SYSTEMS = ["h", "d", "t", "mu-h", "ps", "he+"];
const COUNTS = [10000, 100000, 500000];

export function Controls() {
  const {
    n, l, m, system, basis, view, colorMode, planeQuantity, count,
    systems, setQuantumNumbers, setSystem, setBasis, setView,
    setColorMode, setPlaneQuantity, setCount,
  } = useAppStore();

  const pick = (nn: number, ll: number, mm: number) => {
    const c = clampState(nn, ll, mm);
    setQuantumNumbers(c.n, c.l, c.m);
  };

  const systemOptions =
    systems.length > 0
      ? systems.map((s) => ({ value: s.key, label: `${s.name} (${s.key})` }))
      : PRESET_SYSTEMS.map((k) => ({ value: k, label: k }));

  return (
    <div className="controls">
      <ControlGroup title="State">
        <Select
          label="n"
          value={String(n)}
          options={[1, 2, 3, 4, 5, 6].map((v) => ({ value: String(v), label: `n = ${v}` }))}
          onChange={(v) => pick(Number(v), l, m)}
        />
        <Select
          label="l"
          value={String(l)}
          options={Array.from({ length: n }, (_, v) => ({
            value: String(v),
            label: `l = ${v}`,
          }))}
          onChange={(v) => pick(n, Number(v), m)}
        />
        <Select
          label="m"
          value={String(m)}
          options={Array.from({ length: 2 * l + 1 }, (_, i) => ({
            value: String(i - l),
            label: `m = ${i - l}`,
          }))}
          onChange={(v) => pick(n, l, Number(v))}
        />
        <Select label="system" value={system} options={systemOptions} onChange={setSystem} />
        <Choice<Basis>
          legend="basis"
          value={basis}
          onChange={setBasis}
          options={[
            { value: "complex", label: "complex Y_lm" },
            { value: "real", label: "real orbitals" },
          ]}
        />
      </ControlGroup>
      <ControlGroup title="View">
        <Choice<ViewMode>
          legend="view"
          value={view}
          onChange={setView}
          options={[
            { value: "cloud", label: "cloud" },
            { value: "plane", label: "plane" },
            { value: "radial", label: "radial" },
            { value: "levels", label: "levels" },
          ]}
        />
        <Choice<ColorMode>
          legend="cloud color"
          value={colorMode}
          onChange={setColorMode}
          options={[
            { value: "solid", label: "solid" },
            { value: "density", label: "density" },
            { value: "phase", label: "phase", disabled: basis === "real" },
          ]}
        />
        <Choice<PlaneQuantity>
          legend="plane quantity"
          value={planeQuantity}
          onChange={setPlaneQuantity}
          options={[
            { value: "density", label: "density" },
            { value: "psi", label: "psi" },
          ]}
        />
        <Slider
          label="cloud points"
          readout={count.toLocaleString()}
          min={1000}
          max={1000000}
          step={1000}
          value={COUNTS.reduce((a, b) => (Math.abs(b - count) < Math.abs(a - count) ? b : a))}
          onChange={setCount}
        />
      </ControlGroup>
    </div>
  );
}
