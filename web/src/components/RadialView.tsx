import { scaleLinear } from "d3-scale";
import { useEffect } from "react";
import type { FieldData, Quantity, RadialResponse } from "../api/types";
import { useAppStore } from "../state/store";
import { Badge } from "./Badge";
import { Disclosure } from "./Disclosure";
import { ViewIntro } from "./ViewIntro";

const W = 640;
const H = 240;
const M = { top: 16, right: 16, bottom: 34, left: 56 };

export function zeroCrossings(grid: number[], values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] === 0) continue;
    if (Math.sign(values[i]) !== Math.sign(values[i - 1])) {
      const t = Math.abs(values[i - 1]) / (Math.abs(values[i - 1]) + Math.abs(values[i]));
      out.push(grid[i - 1] + t * (grid[i] - grid[i - 1]));
    }
  }
  return out;
}

export function drawCutoff(values: number[]): number {
  const peak = Math.max(...values.map(Math.abs));
  if (!(peak > 0)) return values.length;
  let end = values.length;
  while (end > 1 && Math.abs(values[end - 1]) < 1e-3 * peak) end--;
  return Math.min(values.length, end + 1);
}

function FieldPlot({
  field,
  title,
  blurb,
  marker,
  markerLabel,
  showNodes = false,
}: {
  field: FieldData;
  title: string;
  blurb: string;
  marker?: Quantity;
  markerLabel?: string;
  showNodes?: boolean;
}) {
  const end = drawCutoff(field.values);
  const grid = field.grid.slice(0, end);
  const values = field.values.slice(0, end);
  const rMax = grid[grid.length - 1];
  const x = scaleLinear([0, rMax], [M.left, W - M.right]);
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values);
  const y = scaleLinear([lo, hi], [H - M.bottom, M.top]).nice();
  const nodes = showNodes ? zeroCrossings(grid, values) : [];
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(grid[i]).toFixed(2)},${y(v).toFixed(2)}`)
    .join(" ");

  return (
    <figure className="plot">
      <figcaption>
        <span className="plot-lead">{title}</span>
        <span className="plot-blurb">{blurb}</span>
        <span className="plot-provenance">
          {`${field.label} [${field.unit}]`} <Badge provenance={field.provenance} />
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" className="plot-static">
        {x.ticks(6).map((t) => (
          <line
            key={`gx-${t}`} x1={x(t)} x2={x(t)} y1={M.top} y2={H - M.bottom}
            className="grid-line"
          />
        ))}
        {y.ticks(4).map((t) => (
          <line
            key={`gy-${t}`} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)}
            className="grid-line"
          />
        ))}
        <line
          x1={M.left} y1={H - M.bottom} x2={W - M.right} y2={H - M.bottom}
          className="axis"
        />
        <line x1={M.left} y1={M.top} x2={M.left} y2={H - M.bottom} className="axis" />
        {x.ticks(6).map((t) => (
          <g key={t} transform={`translate(${x(t)},${H - M.bottom})`}>
            <line y2="5" className="axis" />
            <text y="18" textAnchor="middle" className="tick">
              {t}
            </text>
          </g>
        ))}
        {y.ticks(4).map((t) => (
          <g key={t} transform={`translate(${M.left},${y(t)})`}>
            <line x2="-5" className="axis" />
            <text x="-8" dy="0.32em" textAnchor="end" className="tick">
              {t.toPrecision(2)}
            </text>
          </g>
        ))}
        {lo < 0 && (
          <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} className="zero" />
        )}
        <path d={path} className="curve" />
        {nodes.map((r) => (
          <g key={r} className="node-mark">
            <line x1={x(r)} x2={x(r)} y1={y(0) - 5} y2={y(0) + 5} />
            <circle cx={x(r)} cy={y(0)} r={2.5} />
          </g>
        ))}
        {marker && (
          <g className="marker-group">
            <line
              x1={x(marker.value)} x2={x(marker.value)} y1={M.top} y2={H - M.bottom}
              className="marker"
            />
            <text x={x(marker.value) + 4} y={M.top + 11} className="tick marker-text">
              {markerLabel ?? "⟨r⟩"} = {marker.value.toFixed(2)}
            </text>
          </g>
        )}
        <text
          x={(M.left + W - M.right) / 2} y={H - 4} textAnchor="middle"
          className="axis-title"
        >
          r [{field.grid_unit}]
        </text>
      </svg>
      {nodes.length > 0 && (
        <p className="plot-foot">
          {nodes.length} radial node{nodes.length === 1 ? "" : "s"} marked on the
          axis. The count is n − ℓ − 1, always.
        </p>
      )}
    </figure>
  );
}

export function RadialPlots({
  radial,
  meanRadius,
}: {
  radial: RadialResponse;
  meanRadius?: Quantity;
}) {
  return (
    <>
      <FieldPlot
        field={radial.r_wavefunction}
        title="R(r), the radial wavefunction"
        blurb="The amplitude, sign and all."
        showNodes
      />
      <FieldPlot
        field={radial.radial_probability}
        title="P(r), where the electron actually is"
        blurb="Probability per unit radius."
        marker={meanRadius}
        markerLabel="⟨r⟩"
      />
    </>
  );
}

export function RadialView() {
  const { n, l, system, radial, stateInfo, loadRadial } = useAppStore();
  useEffect(() => {
    void loadRadial();
  }, [n, l, system, loadRadial]);

  if (!radial) {
    return (
      <div className="view-wrap">
        <p className="hint-block">Loading the radial functions…</p>
      </div>
    );
  }

  return (
    <div className="view-wrap">
      <ViewIntro
        lead={{
          title: `Radial functions of ${radial.system.name}`,
          lead: "R(r) is the amplitude with its sign. P(r) is where the electron is.",
        }}
      />
      <RadialPlots radial={radial} meanRadius={stateInfo?.mean_radius ?? undefined} />
      <Disclosure summary="Why the two plots disagree at the nucleus">
        <p className="caption">
          For an s orbital R is largest at r = 0, but P is R² times the shell
          area 4πr², which is zero there. Most likely near the nucleus, never
          exactly at it.
        </p>
      </Disclosure>
    </div>
  );
}
