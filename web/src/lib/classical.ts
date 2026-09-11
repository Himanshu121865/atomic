
export function ghostRadius(tau: number, r0: number): number {
  return r0 * Math.cbrt(1 - tau);
}

export function ghostAngle(tau: number, nOrbits: number): number {
  return 2 * Math.PI * nOrbits * (1 - Math.sqrt(1 - tau));
}

export function slowMotionFactor(collapseSeconds: number, wallSeconds = 5): number {
  return wallSeconds / collapseSeconds;
}

export function tauFromWall(wallElapsed: number, wallSeconds = 5): number {
  return (wallElapsed % wallSeconds) / wallSeconds;
}

export function simSeconds(tau: number, collapseSeconds: number): number {
  return tau * collapseSeconds;
}

export function formatSeconds(s: number): string {
  if (s >= 1e-9) return `${(s * 1e12).toFixed(1)} ps`;
  if (s >= 1e-12) return `${(s * 1e12).toFixed(2)} ps`;
  if (s >= 1e-15) return `${(s * 1e15).toFixed(1)} fs`;
  return `${s.toExponential(2)} s`;
}
