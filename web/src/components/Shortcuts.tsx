import { useEffect, useState } from "react";
import { N_MAX, clampState } from "../lib/quantum";
import { isTypingTarget, matchShortcut } from "../lib/shortcuts";
import { useAppStore } from "../state/store";
import { VIEW_OPTIONS } from "./Controls";

const KEYS: { keys: string; does: string }[] = [
  { keys: "up / down", does: "shell n" },
  { keys: "left / right", does: "orbital l" },
  { keys: "shift + left / right", does: "orientation m" },
  { keys: "1 - 7", does: "the seven views" },
  { keys: "?", does: "this list" },
];

export function Shortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target as HTMLElement | null)) return;
      const hit = matchShortcut(e);
      if (!hit) return;
      const s = useAppStore.getState();
      switch (hit.kind) {
        case "quantum": {
          const n = hit.axis === "n" ? Math.min(s.n + hit.delta, N_MAX) : s.n;
          const l = hit.axis === "l" ? s.l + hit.delta : s.l;
          const m = hit.axis === "m" ? s.m + hit.delta : s.m;
          const next = clampState(n, l, m);
          if (next.n === s.n && next.l === s.l && next.m === s.m) return;
          s.setQuantumNumbers(next.n, next.l, next.m);
          break;
        }
        case "view": {
          const v = VIEW_OPTIONS[hit.index];
          if (v) s.setView(v.value);
          break;
        }
        case "help":
          setOpen((o) => !o);
          break;
        case "close":
          setOpen(false);
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="tour-entry-wrap shortcuts-wrap">
      <button
        className="topbar-btn"
        type="button"
        aria-expanded={open}
        title="Keyboard shortcuts"
        onClick={() => setOpen(!open)}
      >
        keys
      </button>
      {open && (
        <dl className="shortcut-card">
          {KEYS.map((k) => (
            <div key={k.keys} className="shortcut-row">
              <dt>{k.keys}</dt>
              <dd>{k.does}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
