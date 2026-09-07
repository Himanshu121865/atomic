import type { ViewMode } from "../lib/urlState";
import { useAppStore } from "../state/store";

const TABS: { value: ViewMode; label: string }[] = [
  { value: "cloud", label: "Cloud" },
  { value: "plane", label: "Plane" },
  { value: "radial", label: "Radial" },
  { value: "levels", label: "Levels" },
];

export function TopBar() {
  const { view, setView, n, l, m, system } = useAppStore();
  return (
    <header className="topbar">
      <span className="brand">atomic</span>
      <span className="crumb">
        {system} · n={n} l={l} m={m}
      </span>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.value}
            className={view === t.value ? "tab tab-active" : "tab"}
            onClick={() => setView(t.value)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
