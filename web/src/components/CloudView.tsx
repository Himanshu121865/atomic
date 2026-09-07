import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { stateLabel } from "../lib/quantum";
import { cloudColors } from "../lib/cloudColors";
import { useAppStore } from "../state/store";
import { AxisTriad } from "./AxisTriad";
import { Badge } from "./Badge";
import { Legend } from "./Legend";
import { PointCloud } from "./PointCloud";
import { ViewIntro } from "./ViewIntro";

export function CloudView() {
  const {
    n, l, m, system, basis, count,
    positions, density, phase, meta, status, error,
    colorMode, sample,
  } = useAppStore();
  useEffect(() => {
    void sample();
  }, [n, l, m, system, basis, count, sample]);

  const colors = useMemo(
    () => (density ? cloudColors(density, phase, colorMode) : null),
    [density, phase, colorMode],
  );

  if (status === "error") {
    return (
      <div className="view-wrap">
        <p className="hint-block">Sampling failed: {error ?? "unknown reason"}</p>
      </div>
    );
  }
  if (!positions || !colors || !meta) {
    return (
      <div className="view-wrap">
        <p className="hint-block">Sampling the cloud…</p>
      </div>
    );
  }

  let extent = 1;
  for (let i = 0; i < positions.length; i++) {
    const a = Math.abs(positions[i]);
    if (a > extent) extent = a;
  }

  return (
    <div className="view-wrap">
      <ViewIntro
        lead={{
          title: `The ${stateLabel(n, l, m)} cloud in ${meta.system}`,
          lead:
            `${meta.count.toLocaleString()} Monte-Carlo points of |psi|², drawn where ` +
            "the electron is likely to be. Denser dots, denser electron.",
        }}
        badge={<Badge provenance={meta.provenance} />}
      />
      <div className="stage-3d">
        <Canvas camera={{ position: [0, 0, extent * 3], fov: 50 }}>
          <PointCloud positions={positions} colors={colors} size={extent / 200} />
          <AxisTriad extent={extent} />
          <OrbitControls makeDefault />
        </Canvas>
      </div>
      <Legend mode={colorMode} />
      <p className="caption">
        {meta.count.toLocaleString()} points · {meta.basis} basis · drag to orbit, scroll to zoom
      </p>
    </div>
  );
}
