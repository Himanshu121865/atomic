import { Suspense, lazy } from "react";
import { useAppStore } from "./state/store";
import { Controls } from "./components/Controls";
import { InfoPanel } from "./components/InfoPanel";
import { LevelsView } from "./components/LevelsView";
import { PlaneView } from "./components/PlaneView";
import { RadialView } from "./components/RadialView";
import { TopBar } from "./components/TopBar";

const CloudView = lazy(() =>
  import("./components/CloudView").then((m) => ({ default: m.CloudView })),
);

export default function App() {
  const view = useAppStore((s) => s.view);
  return (
    <div className="app">
      <TopBar />
      <div className="app-body">
        <aside className="app-side">
          <Controls />
          <InfoPanel />
        </aside>
        <main className="app-stage">
          {view === "cloud" && (
            <Suspense fallback={<p className="hint-block">Loading the 3-D stage…</p>}>
              <CloudView />
            </Suspense>
          )}
          {view === "plane" && <PlaneView />}
          {view === "radial" && <RadialView />}
          {view === "levels" && <LevelsView />}
        </main>
      </div>
    </div>
  );
}
