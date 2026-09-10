
export function nearestIndex(xs: readonly number[], target: number): number {
  const n = xs.length;
  if (n === 0) return -1;
  if (n === 1) return 0;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= target) lo = mid;
    else hi = mid;
  }
  return target - xs[lo] <= xs[hi] - target ? lo : hi;
}

export function viewBoxX(clientX: number, rect: DOMRect, viewBoxWidth: number): number {
  if (rect.width <= 0) return 0;
  return ((clientX - rect.left) / rect.width) * viewBoxWidth;
}

export function withinPlot(x: number, left: number, right: number): boolean {
  return x >= left && x <= right;
}

export function formatHover(value: number): string {
  if (value === 0) return "0";
  const mag = Math.abs(value);
  if (mag >= 1e4 || mag < 1e-3) return value.toExponential(2);
  return String(Number(value.toPrecision(3)));
}
