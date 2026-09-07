import type { ColorMode } from "../lib/urlState";

export function Legend({ mode }: { mode: ColorMode }) {
  if (mode === "solid") return null;
  return (
    <p className="caption legend">
      {mode === "density" ? (
        <>brightness = electron density, inferno scale, ×√ boosted so faint lobes survive</>
      ) : (
        <>hue = wavefunction phase (blue −π → red +π), brightness = density</>
      )}
    </p>
  );
}
