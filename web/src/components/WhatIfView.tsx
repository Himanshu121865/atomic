import { useEffect } from "react";
import type { DerivedObservable } from "../api/types";
import { formatSeconds } from "../lib/classical";
import { CONST_MAX, CONST_MIN, CONSTANT_KEYS, CONSTANT_LABELS, formatRatio } from "../lib/whatif";
import { useAppStore } from "../state/store";
import { Badge } from "./Badge";
import { ControlGroup, Slider } from "./Field";
import { ViewIntro } from "./ViewIntro";

export function WhatIfView() {
  const {
    labConst, setLabConst, whatif, whatifStatus, loadWhatIf,
    ghost, ghostStatus, loadGhost, n, system,
  } = useAppStore();
  useEffect(() => {
    if (whatif === null && whatifStatus === "idle") void loadWhatIf();
  }, [whatif, whatifStatus, loadWhatIf]);
  useEffect(() => {
    if (ghost === null && ghostStatus === "idle") void loadGhost();
  }, [n, system, ghost, ghostStatus, loadGhost]);

  if (whatifStatus === "error" || !whatif) {
    return (
      <div className="view-wrap">
        <p className="hint-block">
          {whatifStatus === "error" ? "The lab failed to compute." : "Loading the What-If lab…"}
        </p>
      </div>
    );
  }

  const { report } = { report: whatif };
  const readouts: { key: string; label: string; obs: DerivedObservable; text: string }[] = [
    {
      key: "alpha",
      label: "α: fine-structure constant",
      obs: report.alpha,
      text: report.alpha.quantity.value.toExponential(3),
    },
    {
      key: "a0",
      label: "a₀: Bohr radius (atom size)",
      obs: report.bohr_radius_pm,
      text: `${report.bohr_radius_pm.quantity.value.toFixed(2)} pm`,
    },
    {
      key: "eh",
      label: "E_h: Hartree energy (binding)",
      obs: report.hartree_ev,
      text: `${report.hartree_ev.quantity.value.toFixed(3)} eV`,
    },
  ];
  const changed = readouts.filter((r) => r.obs.changed).map((r) => r.label.split(" ")[0]);
  const caption = !report.altered
    ? "Drag any raw constant. Only dimensionless and fixed-ruler quantities are observable: try e ×2 and ε₀ ×4 together."
    : changed.length === 0
      ? "The constants moved, but α, a₀ and E_h all came back unchanged: a different universe, observationally identical to ours."
      : `Altered. Observably changed: ${changed.join(", ")}.`;

  return (
    <div className="view-wrap">
      <ViewIntro
        lead={{
          title: "What if the constants were different?",
          lead:
            "Five sliders over the raw constants of nature. The three readouts below " +
            "are the only things anyone could actually measure.",
        }}
        badge={<Badge provenance={report.alpha.quantity.provenance} />}
      />
      {report.altered && (
        <div className="counterfactual-banner">
          COUNTERFACTUAL · altered constants
        </div>
      )}
      <h3 className="readouts-head">The three things you could actually measure</h3>
      <dl className="readouts">
        {readouts.map((r) => (
          <div key={r.key} className="readout-row">
            <dt>
              {r.label} <Badge provenance={r.obs.quantity.provenance} />
            </dt>
            <dd>
              {r.text}{" "}
              <span className={r.obs.changed ? "readout-ratio changed" : "readout-ratio"}>
                {formatRatio(r.obs.ratio)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="caption">{caption}</p>
      <ControlGroup
        title="Or move one constant at a time"
        hint="Each slider runs from a quarter to four times its measured value."
      >
        <div className="const-sliders">
          {CONSTANT_KEYS.map((k) => (
            <Slider
              key={k}
              label={CONSTANT_LABELS[k]}
              readout={`×${labConst[k].toFixed(2)}`}
              min={Math.log2(CONST_MIN)}
              max={Math.log2(CONST_MAX)}
              step={0.25}
              value={Math.log2(labConst[k])}
              onChange={(v) => setLabConst({ [k]: 2 ** v })}
            />
          ))}
        </div>
      </ControlGroup>
      <button
        type="button"
        className="primary"
        disabled={!report.altered}
        onClick={() => setLabConst({ hbar: 1, e: 1, m_e: 1, eps0: 1, c: 1 })}
      >
        reset to real constants
      </button>
      <h3 className="readouts-head">The classical ghost: what Newton predicts</h3>
      {ghostStatus === "error" || !ghost ? (
        <p className="hint-block">
          {ghostStatus === "error" ? "The ghost failed to compute." : "Raising the ghost…"}
        </p>
      ) : (
        <div>
          <p className="caption">
            A classical electron spirals into the nucleus in{" "}
            <strong>{formatSeconds(ghost.collapse_time_s.value)}</strong> after{" "}
            {ghost.orbit_count.value.toExponential(2)} orbits.{" "}
            <Badge provenance={ghost.collapse_time_s.provenance} />
          </p>
          <dl className="readouts">
            {ghost.orbits.map((o) => (
              <div key={o.n} className="readout-row">
                <dt>Bohr orbit n={o.n}</dt>
                <dd>{o.radius_pm.value.toFixed(1)} pm</dd>
              </div>
            ))}
          </dl>
          <p className="caption">
            Quantum mechanics forbids the collapse. That refusal is the whole lesson.
          </p>
        </div>
      )}
    </div>
  );
}
