
export type Shortcut =
  | { kind: "quantum"; axis: "n" | "l" | "m"; delta: -1 | 1 }
  | { kind: "view"; index: number }
  | { kind: "help" }
  | { kind: "close" };

export interface KeyEventLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

export function isTypingTarget(target: TargetLike | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

export function matchShortcut(e: KeyEventLike): Shortcut | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case "ArrowUp":
      return { kind: "quantum", axis: "n", delta: 1 };
    case "ArrowDown":
      return { kind: "quantum", axis: "n", delta: -1 };
    case "ArrowRight":
      return { kind: "quantum", axis: e.shiftKey ? "m" : "l", delta: 1 };
    case "ArrowLeft":
      return { kind: "quantum", axis: e.shiftKey ? "m" : "l", delta: -1 };
    case "?":
      return { kind: "help" };
    case "Escape":
      return { kind: "close" };
  }
  if (/^[1-7]$/.test(e.key) && !e.shiftKey) return { kind: "view", index: Number(e.key) - 1 };
  return null;
}
