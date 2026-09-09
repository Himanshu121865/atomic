import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { currentUrlState, parseAppUrl, serializeAppUrl } from "./lib/urlState";
import { useAppStore } from "./state/store";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";

const opening = parseAppUrl(window.location.search);
useAppStore.setState(opening);

{
  const settled = useAppStore.getState();
  void settled.loadSystems().then(() => void settled.loadStateInfo());
  if (settled.view === "cloud") void settled.sample();
  else if (settled.view === "plane") void settled.loadPlane();
  else if (settled.view === "radial") void settled.loadRadial();
  else if (settled.view === "whatif") {
    void settled.loadWhatIf();
    void settled.loadGhost();
  } else if (settled.view === "forcelaw") void settled.loadForceLaw();
  else void settled.loadLevels();
}

useAppStore.subscribe((s) => {
  const qs = serializeAppUrl(currentUrlState(s));
  const next = window.location.pathname + qs;
  if (next !== window.location.pathname + window.location.search) {
    window.history.replaceState(null, "", next);
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
