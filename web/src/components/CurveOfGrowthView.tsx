import { scaleLinear } from "d3-scale";
import type { CurveOfGrowthInfo, GrowthRegime } from "../api/types";
import { Notation } from "../lib/mathText";
import { Badge } from "./Badge";

const W = 680;
const H = 260;
const M = { left: 62, right: 16, top: 20, bottom: 34 };

export const REGIME_COLOR: Record<GrowthRegime, string> = {
  linear: "#4ade80",
  saturated: "#fbbf24",
  damping: "#7dd3fc",
};

export const REGIME_LABEL: Record<GrowthRegime, string> = {
  linear: "linear (slope 1)",
  saturated: "saturated (slope ≈ 0)",
  damping: "damping (slope ½)",
};

export function regimeSegments(
  regime: GrowthRegime[],
): { regime: GrowthRegime; start: number; end: number }[] {
  const out: { regime: GrowthRegime; start: number; end: number }[] = [];
  for (let i = 0; i < regime.length; i++) {
    const last = out[out.length - 1];
    if (last && last.regime === regime[i]) {
      last.end = i;
    } else {
      out.push({ regime: regime[i], start: Math.max(0, i - 1), end: i });
    }
  }
  return out;
}

export function logLogPath(
  xs: number[],
  ys: number[],
  start: number,
  end: number,
  x: (v: number) => number,
  y: (v: number) => number,
): string {
  const parts: string[] = [];
  for (let i = start; i <= end && i < xs.length; i++) {
    if (!(xs[i] > 0) || !(ys[i] > 0)) continue;
    const cmd = parts.length === 0 ? "M" : "L";
    parts.push(`${cmd}${x(Math.log10(xs[i])).toFixed(2)} ${y(Math.log10(ys[i])).toFixed(2)}`);
  }
  return parts.join(" ");
}

export function logDomain(values: number[]): [number, number] {
  const logs = values.filter((v) => v > 0 && Number.isFinite(v)).map(Math.log10);
  if (logs.length === 0) return [0, 1];
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  return hi > lo ? [lo, hi] : [lo - 1, hi + 1];
}

export function decadeTicks(lo: number, hi: number, max = 8): number[] {
  const first = Math.ceil(lo);
  const last = Math.floor(hi);
  const all: number[] = [];
  for (let e = first; e <= last; e++) all.push(e);
  if (all.length <= max) return all;
  const step = Math.ceil(all.length / max);
  return all.filter((_, i) => i % step === 0);
}

export function CurveOfGrowthView({ cog }: { cog: CurveOfGrowthInfo }) {
  const logN = logDomain(cog.column_density_m2);
  const logW = logDomain(cog.equivalent_width_nm);
  const x = scaleLinear(logN, [M.left, W - M.right]);
  const y = scaleLinear(logW, [H - M.bottom, M.top]);
  const segments = regimeSegments(cog.regime);
  const present = [...new Set(cog.regime)];

  return (
    <>
      <div className="view-header">
        <span className="plot-title">
          Curve of growth: <Notation>{cog.label}</Notation> at{" "}
          {cog.wavelength_nm.toFixed(2)} nm{" "}
          <Badge provenance={cog.provenance} />
        </span>
        <span className="legend-inline">
          {present.map((r) => (
            <span key={r} style={{ color: REGIME_COLOR[r] }}>
              ▎{REGIME_LABEL[r]}
            </span>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" className="levels-svg">
        <line
          x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom}
          className="axis"
        />
        <line
          x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} className="axis"
        />
        {decadeTicks(x.domain()[0], x.domain()[1]).map((e) => (
          <g key={e} transform={`translate(${x(e)},${H - M.bottom})`}>
            <line y2="5" className="axis" />
            <text y="17" textAnchor="middle" className="tick">
              10<tspan className="exponent" dy="-3.5">{exponentLabel(e)}</tspan>
            </text>
          </g>
        ))}
        {decadeTicks(y.domain()[0], y.domain()[1], 6).map((e) => (
          <g key={e} transform={`translate(${M.left},${y(e)})`}>
            <line x2="-5" className="axis" />
            <text x="-9" dy="3" textAnchor="end" className="tick">
              10<tspan className="exponent" dy="-3.5">{exponentLabel(e)}</tspan>
            </text>
          </g>
        ))}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={logLogPath(
              cog.column_density_m2, cog.equivalent_width_nm,
              seg.start, seg.end, x, y,
            )}
            fill="none"
            stroke={REGIME_COLOR[seg.regime]}
            strokeWidth={2}
          />
        ))}
        <text x={W - M.right} y={H - 4} textAnchor="end" className="tick">
          column density in the lower level [m⁻²]
        </text>
        <text x={4} y={12} className="tick">
          equivalent width [nm]
        </text>
      </svg>
      <p className="caption">
        How much light the line removes, against how much gas sits in the way.
        The three branches are the whole point. While the core is still
        transparent, every atom absorbs as much as the last and the width
        tracks the column exactly (slope 1). Once the core goes black it cannot
        absorb any more, so the line only grows through its Doppler shoulders,
        and <strong>a hundred times more gas barely widens it</strong>. That is
        why a strong line makes a poor measure of how much gas there is. Far
        enough along, the Lorentzian wings from the upper level's finite
        lifetime take over and growth resumes at slope ½.
      </p>
      <p className="caption">
        Every other view assumes the gas is optically thin, which is only the
        first branch here. f = <Notation>{cog.oscillator_strength.toExponential(3)}</Notation>,
        Gaussian σ = <Notation>{cog.sigma_nm.toExponential(2)}</Notation> nm, Lorentzian γ ={" "}
        <Notation>{cog.gamma_nm.toExponential(2)}</Notation> nm, damping parameter a ={" "}
        <Notation>{cog.damping_parameter.toExponential(2)}</Notation>. The knees sit where τ at line
        centre reaches 1 and where a·τ reaches 1, so heating the gas widens the
        line and pushes the first knee to a higher column. That is exactly how
        a real curve-of-growth fit measures a temperature.
      </p>
    </>
  );
}

export function exponentLabel(e: number): string {
  return (e < 0 ? "−" : "") + Math.abs(e).toString();
}
