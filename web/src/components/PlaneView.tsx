import { useEffect, useRef } from "react";
import { stateLabel } from "../lib/quantum";
import { rasterize } from "../lib/rasterize";
import { useAppStore } from "../state/store";
import { Badge } from "./Badge";
import { ViewIntro } from "./ViewIntro";

export function PlaneView() {
  const {
    n, l, m, system, basis, planeQuantity,
    plane, planeStatus, loadPlane,
  } = useAppStore();
  useEffect(() => {
    void loadPlane();
  }, [n, l, m, system, basis, planeQuantity, loadPlane]);

  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !plane) return;
    const { resolution, quantity } = plane.meta;
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(
      new ImageData(rasterize(plane.values, resolution, quantity), resolution, resolution),
      0,
      0,
    );
  }, [plane]);

  if (planeStatus === "error" || !plane) {
    return (
      <div className="view-wrap">
        <p className="hint-block">
          {planeStatus === "error" ? "The cross-section failed to compute." : "Cutting the plane…"}
        </p>
      </div>
    );
  }

  return (
    <div className="view-wrap">
      <ViewIntro
        lead={{
          title: `The ${stateLabel(n, l, m)} cross-section`,
          lead:
            plane.meta.quantity === "density"
              ? "Electron density sliced on the y=0 plane. What you see is where the electron lives in that sheet."
              : "Signed wavefunction sliced on the y=0 plane. ψ is real there, so red/blue is an honest sign, not a phase trick.",
          notice: `Spans ±${plane.meta.half_extent.toFixed(1)} bohr. +z is up.`,
        }}
        badge={<Badge provenance={plane.meta.provenance} />}
      />
      <canvas ref={ref} className="plane-canvas" />
    </div>
  );
}
