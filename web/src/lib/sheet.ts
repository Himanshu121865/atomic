
export const SNAPS = ["collapsed", "half", "full"] as const;
export type Snap = (typeof SNAPS)[number];

export const PEEK_HEIGHT = 56;

export const SHORT_VIEWPORT = 500;

export function snapHeight(snap: Snap, viewportHeight: number): number {
  if (snap === "collapsed") return PEEK_HEIGHT;
  const short = viewportHeight < SHORT_VIEWPORT;
  const fraction = snap === "half" ? (short ? 0.35 : 0.45) : short ? 0.6 : 0.9;
  return Math.round(viewportHeight * fraction);
}

const FLING = 0.5;

export function nextSnap(
  current: Snap,
  offset: number,
  velocity: number,
  viewportHeight: number,
): Snap {
  const i = SNAPS.indexOf(current);
  if (velocity <= -FLING) return SNAPS[Math.min(i + 1, SNAPS.length - 1)];
  if (velocity >= FLING) return SNAPS[Math.max(i - 1, 0)];
  const held = snapHeight(current, viewportHeight) - offset;
  const distance = (s: Snap) => Math.abs(snapHeight(s, viewportHeight) - held);
  return SNAPS.reduce((best, s) => (distance(s) < distance(best) ? s : best));
}
