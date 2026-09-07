import { useEffect } from "react";
import { useAppStore } from "../state/store";
import { Badge } from "./Badge";

export function InfoPanel() {
  const { n, l, m, system, stateInfo, loadStateInfo } = useAppStore();
  useEffect(() => {
    void loadStateInfo();
  }, [n, l, m, system, loadStateInfo]);

  if (!stateInfo) {
    return (
      <div className="info-panel">
        <p className="hint-block">Loading the state…</p>
      </div>
    );
  }

  return (
    <div className="info-panel">
      <h3>
        {stateInfo.system.name} {n}
        {["s", "p", "d", "f", "g", "h"][l] ?? `l=${l}`}
      </h3>
      <dl className="state-facts">
        <div>
          <dt>energy</dt>
          <dd>
            {stateInfo.energy_ev.value.toFixed(3)} eV <Badge provenance={stateInfo.energy.provenance} />
          </dd>
        </div>
        <div>
          <dt>mean radius</dt>
          <dd>{stateInfo.mean_radius.value.toFixed(3)} bohr</dd>
        </div>
        <div>
          <dt>nodes</dt>
          <dd>
            {stateInfo.radial_nodes} radial · {stateInfo.angular_nodes} angular
          </dd>
        </div>
        <div>
          <dt>|L|</dt>
          <dd>
            {stateInfo.angular_momentum.value.toFixed(3)} ħ
          </dd>
        </div>
      </dl>
    </div>
  );
}
