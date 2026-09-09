export function formatSeconds(s: number): string {
  if (s >= 1e-9) return `${(s * 1e12).toFixed(1)} ps`;
  if (s >= 1e-12) return `${(s * 1e12).toFixed(2)} ps`;
  if (s >= 1e-15) return `${(s * 1e15).toFixed(1)} fs`;
  return `${s.toExponential(2)} s`;
}
