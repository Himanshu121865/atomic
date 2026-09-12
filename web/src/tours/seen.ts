
const KEY = "atomic.tours.v1";

export interface TourMemory {
  dismissed: boolean;
  completed: string[];
}

export function noMemory(): TourMemory {
  return { dismissed: false, completed: [] };
}

export function shouldInvite(m: TourMemory): boolean {
  return !m.dismissed;
}

export function withCompleted(m: TourMemory, id: string): TourMemory {
  return {
    dismissed: true,
    completed: m.completed.includes(id) ? [...m.completed] : [...m.completed, id],
  };
}

export function parseMemory(raw: string | null): TourMemory {
  if (!raw) return noMemory();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return noMemory();
  }
  if (typeof value !== "object" || value === null) return noMemory();
  const rec = value as Record<string, unknown>;
  return {
    dismissed: rec.dismissed === true,
    completed: Array.isArray(rec.completed)
      ? rec.completed.filter((x): x is string => typeof x === "string")
      : [],
  };
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readMemory(): TourMemory {
  const s = storage();
  if (!s) return noMemory();
  try {
    return parseMemory(s.getItem(KEY));
  } catch {
    return noMemory();
  }
}

export function writeMemory(m: TourMemory): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(m));
  } catch {
  }
}

export function rememberDismissed(): TourMemory {
  const m = { ...readMemory(), dismissed: true };
  writeMemory(m);
  return m;
}

export function rememberCompleted(id: string): TourMemory {
  const m = withCompleted(readMemory(), id);
  writeMemory(m);
  return m;
}
