import { scaleLinear } from "d3-scale";
import { useEffect } from "react";
import { isScreenedLevels } from "../api/client";
import type {
  FineLevel,
  GrossLevel,
  LevelsResponse,
  ScreenedLevels,
} from "../api/types";
import { useAppStore } from "../state/store";
import { Badge } from "./Badge";
import { ControlGroup, Slider, Toggle } from "./Field";
import { Disclosure } from "./Disclosure";
import { ViewIntro } from "./ViewIntro";

const W = 680;
const H = 460;

const HARTREE_UEV = 27.211386245988e6;
const MU_B_UEV_PER_T = (0.5 / 2.35051756758e5) * HARTREE_UEV;

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
  const es = levels.gross.map((g) => g.energy_ev.value);
  const eMin = Math.min(...es);
  const y = scaleLinear([eMin, 0], [H - 40, 24]);
  const rungX1 = 70;
  const rungX2 = 320;
  let lastLabelY = Number.POSITIVE_INFINITY;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="levels-svg">
      <line x1={rungX1} x2={rungX2} y1={y(0)} y2={y(0)} className="zero" />
      <text x={rungX2 + 30} y={y(0)} dy="0.32em" className="tick">
        0: ionization limit
      </text>
      {levels.gross.map((g) => {
        const yr = y(g.energy_ev.value);
        const labelled = Math.abs(yr - lastLabelY) >= 16;
        if (labelled) lastLabelY = yr;
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
            {labelled && (
              <>
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
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function FineFan({
  shell,
  grossEv,
  dirac,
}: {
  shell: FineLevel[];
  grossEv: number;
  dirac: boolean;
}) {
  if (shell.length === 0) return null;
  const splits = shell.map((f) => ({
    f,
    rel: dirac ? (f.energy_ev.value - grossEv) * 1e6 : f.shift_ev.value * 1e6,
  }));
  const rels = splits.map((s) => s.rel);
  const pad = Math.max(1, ...rels.map(Math.abs)) * 0.3;
  const y = scaleLinear(
    [Math.min(...rels, 0) - pad, Math.max(...rels, 0) + pad],
    [150, 30],
  );
  return (
    <svg viewBox="0 0 360 180" role="img" className="levels-zoom-svg">
      <line x1={30} x2={120} y1={y(0)} y2={y(0)} className="zero" />
      <text x={124} y={y(0)} dy="0.32em" className="tick">
        gross level
      </text>
      {splits.map((s, i) => (
        <g key={i}>
          <line x1={30} x2={120} y1={y(s.rel)} y2={y(s.rel)} className="rung" />
          <text x={124} y={y(s.rel)} dy="0.32em" className="tick">
            {`j=${s.f.j} · ${s.rel >= 0 ? "+" : ""}${s.rel.toFixed(1)} µeV`}
          </text>
        </g>
      ))}
      <text x={30} y={172} className="tick">
        {dirac ? "Dirac exact, (n,j) only" : "α² fine structure, µeV below gross"}
      </text>
    </svg>
  );
}

export function ZeemanFan({ fine, bField }: { fine: FineLevel; bField: number }) {
  const subs = fine.sublevels ?? [];
  if (subs.length === 0 || bField <= 0) return null;
  const parentEv = fine.energy_ev.value;
  const rels = subs.map((s) => (s.energy_ev.value - parentEv) * 1e6);
  const pad = Math.max(...rels.map(Math.abs), 1) * 0.3;
  const y = scaleLinear([Math.min(...rels) - pad, Math.max(...rels) + pad], [170, 30]);
  return (
    <svg viewBox="0 0 360 200" role="img" className="levels-zoom-svg">
      <line x1={30} x2={110} y1={y(0)} y2={y(0)} className="zero" />
      <text x={114} y={y(0)} dy="0.32em" className="tick">
        un-split j-level
      </text>
      {subs.map((s, i) => (
        <g key={i}>
          <line x1={30} x2={110} y1={y(rels[i])} y2={y(rels[i])} className="rung" />
          <text x={114} y={y(rels[i])} dy="0.32em" className="tick">
            {`m_j=${s.m_j} · ${rels[i] >= 0 ? "+" : ""}${rels[i].toFixed(1)} µeV`}
          </text>
        </g>
      ))}
      <text x={30} y={192} className="tick">
        {`B = ${bField} T · high field: ${subs[0]?.high_field_label ?? ""}`}
      </text>
    </svg>
  );
}

export function StarkFan({ gross, eField }: { gross: GrossLevel; eField: number }) {
  const subs = gross.sublevels ?? [];
  if (subs.length === 0 || eField <= 0) return null;
  const parentEv = gross.energy_ev.value;
  const rels = subs.map((s) => (s.energy_ev.value - parentEv) * 1000);
  const pad = Math.max(...rels.map(Math.abs), 1) * 0.3;
  const y = scaleLinear([Math.min(...rels) - pad, Math.max(...rels) + pad], [170, 30]);
  return (
    <svg viewBox="0 0 380 200" role="img" className="levels-zoom-svg">
      <line x1={30} x2={110} y1={y(0)} y2={y(0)} className="zero" />
      <text x={114} y={y(0)} dy="0.32em" className="tick">
        gross E_n
      </text>
      {subs.map((s, i) => (
        <g key={i}>
          <line x1={30} x2={110} y1={y(rels[i])} y2={y(rels[i])} className="rung" />
          <text x={114} y={y(rels[i])} dy="0.32em" className="tick">
            {`k=${s.k} · ${rels[i] >= 0 ? "+" : ""}${rels[i].toFixed(2)} meV`}
          </text>
        </g>
      ))}
      <text x={30} y={192} className="tick">
        {`F = ${eField} MV/m · linear fan (l-degenerate) + quadratic`}
      </text>
    </svg>
  );
}

export function ScreenedLadder({ levels }: { levels: ScreenedLevels }) {
  const es = levels.orbitals.map((o) => o.energy_ev.value);
  const eMin = Math.min(...es);
  const y = scaleLinear([eMin, 0], [H - 40, 24]);
  const rungX1 = 90;
  const rungX2 = 340;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="levels-svg">
      <line x1={rungX1} x2={rungX2} y1={y(0)} y2={y(0)} className="zero" />
      <text x={rungX2 + 30} y={y(0)} dy="0.32em" className="tick">
        0: ionization limit
      </text>
      {levels.orbitals.map((o) => {
        const yr = y(o.energy_ev.value);
        const filled = o.occupancy > 0;
        return (
          <g key={`${o.n}-${o.l}`}>
            <line
              x1={rungX1} x2={rungX2} y1={yr} y2={yr}
              className="rung"
              strokeWidth={filled ? 3 : 1.5}
              strokeDasharray={filled ? undefined : "4 4"}
              opacity={filled ? 1 : 0.5}
            />
            <text
              x={rungX1 - 32} y={yr} dy="0.32em"
              textAnchor="end" className="tick"
            >
              {o.label}
              {filled ? <tspan dy="-0.5em">{o.occupancy}</tspan> : ""}
            </text>
            <text x={rungX2 + 30} y={yr} dy="0.32em" className="tick">
              {o.energy_ev.value.toFixed(2)} eV
              {filled ? "" : " · virtual"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LevelsView() {
  const {
    n, l, system, levels,
    loadLevels, setQuantumNumbers,
    fineStructure, setFineStructure,
    dirac, setDirac,
    bField, setBField,
    eField, setEField,
    hyperfine, setHyperfine,
  } = useAppStore();
  useEffect(() => {
    void loadLevels();
  }, [system, fineStructure, dirac, bField, eField, hyperfine, loadLevels]);

  if (!levels) {
    return (
      <div className="view-wrap">
        <p className="hint-block">Loading the levels…</p>
      </div>
    );
  }

  if (isScreenedLevels(levels)) {
    return (
      <div className="view-wrap">
        <ViewIntro
          lead={{
            title: `Energy levels of ${levels.system.name}`,
            lead:
              "Each rung is one subshell in a fitted central field. " +
              "Solid rungs hold electrons, dashed ones are empty.",
          }}
          badge={<Badge provenance={levels.orbitals[0].energy.provenance} />}
        >
          <p className="view-intro-config">
            {levels.config}
            {levels.is_ground ? " · ground configuration" : " · excited, not the ground state"}
          </p>
        </ViewIntro>
        <ScreenedLadder levels={levels} />
        <p className="caption">
          Total energy {levels.total_energy_ev.value.toFixed(2)} eV.
        </p>
      </div>
    );
  }

  const activeGross = levels.gross.find((g) => g.n === n) ?? levels.gross[0];
  const fineForN = levels.fine?.filter((f) => f.n === activeGross.n) ?? [];
  const hfShell = levels.hyperfine_shells?.find((s) => s.n === 1);

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
        badge={<Badge provenance={levels.gross[0].energy.provenance} />}
      />
      <ControlGroup title="Level detail">
        <Toggle
          label="fine structure (α²)"
          checked={fineStructure}
          onChange={setFineStructure}
        />
        {fineStructure && (
          <Toggle
            label="Dirac exact (instead of α² perturbative)"
            checked={dirac}
            onChange={setDirac}
          />
        )}
        {fineStructure && (
          <Slider
            label="magnetic field B"
            readout={`${bField.toFixed(1)} T`}
            min={0}
            max={20}
            step={0.1}
            value={bField}
            onChange={setBField}
          />
        )}
        {!fineStructure && (
          <p className="control-hint">turn on fine structure to add a magnetic field</p>
        )}
        <Slider
          label="electric field F"
          readout={`${eField.toFixed(1)} MV/m`}
          min={0}
          max={100}
          step={1}
          value={eField}
          onChange={setEField}
        />
        <Toggle
          label="hyperfine (nuclear spin, s-states)"
          checked={hyperfine}
          onChange={setHyperfine}
        />
        {hyperfine && hfShell !== undefined && !hfShell.available && (
          <p className="control-hint">{hfShell.reason}</p>
        )}
      </ControlGroup>
      <LevelsLadder
        levels={levels}
        activeN={n}
        maxL={l}
        onPick={(nn, ll) => setQuantumNumbers(nn, ll, 0)}
      />
      {fineStructure && fineForN.length > 0 && bField <= 0 && (
        <FineFan
          shell={fineForN}
          grossEv={activeGross.energy_ev.value}
          dirac={dirac}
        />
      )}
      {fineStructure && bField > 0 && (
        <>
          {fineForN.map((f) => (
            <ZeemanFan key={`${f.n}-${f.l}-${f.j}`} fine={f} bField={bField} />
          ))}
        </>
      )}
      {eField > 0 && <StarkFan gross={activeGross} eField={eField} />}
      <Disclosure summary="What the scale means">
        <p className="caption">
          {fineStructure && dirac
            ? "Dirac is exact for a point nucleus: the energy depends on n and j only, " +
              "so 2s₁/₂ and 2p₁/₂ coincide. Reality splits them by the Lamb shift, which " +
              "this model omits."
            : fineStructure
              ? "The α² fine structure splits each shell by (n, j): spin-orbit, " +
                "relativistic kinetic energy and the Darwin term. Exact Dirac energies " +
                "are one toggle away."
              : "Gross levels only: every shell exact under the reduced-mass model, no " +
                "fine structure yet. Turn it on above."}
          {eField > 0
            ? " With an electric field, each shell fans linearly in the parabolic quantum " +
              "number k — hydrogen's l-degeneracy signature. The model omits field ionization " +
              "(the perturbation series breaks down near F_ion)."
            : ""}
          {bField > 0
            ? " A magnetic field splits each j-level into 2j+1 m_j sublevels (anomalous " +
              "Zeeman); as B rises they reorganize into the Paschen-Back pattern where " +
              "(m_l, m_s) become the good labels. The diamagnetic B² term is omitted."
            : ""}
        </p>
      </Disclosure>
      {hyperfine && hfShell !== undefined && hfShell.available && (
        <div>
          <p className="caption">
            Hyperfine of 1s ({hfShell.nucleus}, I={hfShell.I}):
            {" "}
            {hfShell.levels.map((lv) => `F=${lv.F}`).join(", ")}. The F=1→F=0
            transition of hydrogen is the 21 cm line, 1420.4058 MHz.
          </p>
        </div>
      )}
      <MU_B_NOTE />
    </div>
  );
}

function MU_B_NOTE() {
  const bField = useAppStore((s) => s.bField);
  if (bField <= 0) return null;
  return (
    <p className="caption">
      Current field: µ_B·B = {(bField * MU_B_UEV_PER_T).toFixed(1)} µeV per m_j unit.
    </p>
  );
}
