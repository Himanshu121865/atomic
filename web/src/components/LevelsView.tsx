import { scaleLinear } from "d3-scale";
import { useEffect } from "react";
import type { LevelsResponse } from "../api/types";
import { useAppStore } from "../state/store";
import { Badge } from "./Badge";
import { Disclosure } from "./Disclosure";
import { ViewIntro } from "./ViewIntro";

const W = 680;
const H = 460;

export function LevelsLadder({
  levels,
  activeN,
  maxL,
  onPick,
}: {
  levels: LevelsResponse;
  activeN: number;
  maxL: number;
  onPick: (n: number, l: number) => void;
}) {
  const es = levels.levels.map((g) => g.energy_ev.value);
  const eMin = Math.min(...es);
  const y = scaleLinear([eMin, 0], [H - 40, 24]);
  const rungX1 = 70;
  const rungX2 = 320;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="levels-svg">
      <line x1={rungX1} x2={rungX2} y1={y(0)} y2={y(0)} className="zero" />
      <text x={rungX2 + 30} y={y(0)} dy="0.32em" className="tick">
        0: ionization limit
      </text>
      {levels.levels.map((g) => {
        const yr = y(g.energy_ev.value);
        const pick = () => onPick(g.n, Math.min(maxL, g.n - 1));
        return (
          <g
            key={g.n}
            className="rung-hit"
            role="button"
            tabIndex={0}
            aria-label={`select shell n=${g.n}`}
            onClick={pick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pick();
              }
            }}
          >
            <line
              x1={rungX1} x2={rungX2} y1={yr} y2={yr}
              className={g.n === activeN ? "rung rung-active" : "rung"}
            />
            <text
              x={rungX1 - 32} y={yr} dy="0.32em"
              textAnchor="end" className="tick"
            >
              n={g.n}
            </text>
            <text x={rungX2 + 30} y={yr} dy="0.32em" className="tick">
              {g.energy_ev.value.toFixed(2)} eV · 2n²={g.degeneracy}
              {g.n === 1 ? " · ground state" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LevelsView() {
  const { n, l, system, levels, loadLevels, setQuantumNumbers } = useAppStore();
  useEffect(() => {
    void loadLevels();
  }, [system, loadLevels]);

  if (!levels) {
    return (
      <div className="view-wrap">
        <p className="hint-block">Loading the levels…</p>
      </div>
    );
  }

  return (
    <div className="view-wrap">
      <ViewIntro
        lead={{
          title: `Energy levels of ${levels.system.name}`,
          lead:
            "Each rung is one shell's gross energy under a reduced-mass Bohr model. " +
            "Click a rung and every view moves to that shell.",
          notice:
            "The rungs crowd toward the ionization limit at 0 because the energies go as −1/n².",
        }}
        badge={<Badge provenance={levels.levels[0].energy.provenance} />}
      />
      <LevelsLadder
        levels={levels}
        activeN={n}
        maxL={l}
        onPick={(nn, ll) => setQuantumNumbers(nn, ll, 0)}
      />
      <Disclosure summary="What the scale means">
        <p className="caption">
          Gross levels only: every shell exact under the reduced-mass model, no
          fine structure yet. That arrives in a later phase.
        </p>
      </Disclosure>
    </div>
  );
}
