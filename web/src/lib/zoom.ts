
export type Domain = readonly [number, number];

const MIN_SPAN = 1e-4;

function usableLog(full: Domain, log: boolean): boolean {
  return log && full[0] > 0 && full[1] > 0;
}

const fwd = (v: number, log: boolean) => (log ? Math.log10(v) : v);
const inv = (t: number, log: boolean) => (log ? 10 ** t : t);

function ordered(d: Domain): [number, number] {
  return d[0] <= d[1] ? [d[0], d[1]] : [d[1], d[0]];
}

export function clampView(view: Domain, full: Domain, log = false): [number, number] {
  const lg = usableLog(full, log);
  const [fLo, fHi] = ordered(full).map((v) => fwd(v, lg)) as [number, number];
  const fSpan = fHi - fLo;
  if (!(fSpan > 0)) return ordered(full);
  const [vLo0, vHi0] = ordered(view).map((v) => fwd(v, lg)) as [number, number];
  const span = Math.min(Math.max(vHi0 - vLo0, fSpan * MIN_SPAN), fSpan);
  let lo = vLo0;
  if (lo + span > fHi) lo = fHi - span;
  if (lo < fLo) lo = fLo;
  return [inv(lo, lg), inv(lo + span, lg)];
}

export function zoomView(
  view: Domain,
  full: Domain,
  factor: number,
  anchor = 0.5,
  log = false,
): [number, number] {
  const lg = usableLog(full, log);
  const [vLo, vHi] = ordered(view).map((v) => fwd(v, lg)) as [number, number];
  const span = vHi - vLo;
  if (!(span > 0) || !(factor > 0)) return ordered(view);
  const a = Math.min(Math.max(anchor, 0), 1);
  const at = vLo + a * span;
  const next = span * factor;
  return clampView([inv(at - a * next, lg), inv(at + (1 - a) * next, lg)], full, log);
}

export function panView(
  view: Domain,
  full: Domain,
  fraction: number,
  log = false,
): [number, number] {
  const lg = usableLog(full, log);
  const [vLo, vHi] = ordered(view).map((v) => fwd(v, lg)) as [number, number];
  const shift = (vHi - vLo) * fraction;
  return clampView([inv(vLo + shift, lg), inv(vHi + shift, lg)], full, log);
}

export function zoomFactor(view: Domain, full: Domain, log = false): number {
  const lg = usableLog(full, log);
  const [vLo, vHi] = ordered(view).map((v) => fwd(v, lg)) as [number, number];
  const [fLo, fHi] = ordered(full).map((v) => fwd(v, lg)) as [number, number];
  const span = vHi - vLo;
  if (!(span > 0) || !(fHi - fLo > 0)) return 1;
  return (fHi - fLo) / span;
}

export function isZoomed(view: Domain, full: Domain, log = false): boolean {
  return zoomFactor(view, full, log) > 1.001;
}

export function withinView<T>(rows: readonly T[], value: (row: T) => number, view: Domain): T[] {
  const [lo, hi] = ordered(view);
  return rows.filter((r) => {
    const v = value(r);
    return v >= lo && v <= hi;
  });
}
