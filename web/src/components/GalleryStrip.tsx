import { thumbnailUrl } from "../api/client";
import type { Basis } from "../api/client";
import { galleryStates } from "../lib/gallery";
import { subshellAvailable } from "../lib/hfModel";
import { THUMBNAIL_LIBERTY } from "../lib/liberties";
import { stateLabel } from "../lib/quantum";
import { isHydrogenic } from "../lib/systemKind";
import { useAppStore } from "../state/store";
import { Badge } from "./Badge";

export function GalleryStrip() {
  const { n, l, m, system, systems, basis, setQuantumNumbers, hfLevels, model } = useAppStore();
  const hasThumbnails = isHydrogenic(systems, system);
  return (
    <div className="gallery">
      <div className="gallery-head">
        <span>n = {n} states</span>
        {hasThumbnails && <Badge provenance={THUMBNAIL_LIBERTY} />}
      </div>
      <div className="gallery-scroll">
        {galleryStates(n).map((s) => {
          const active = s.l === l && s.m === m;
          const reachable = subshellAvailable(hfLevels, model, s.n, s.l);
          return (
            <button
              key={`${s.l},${s.m}`}
              type="button"
              className={active ? "thumb thumb-active" : "thumb"}
              disabled={!reachable}
              title={
                reachable
                  ? stateLabel(s.n, s.l, s.m)
                  : `${stateLabel(s.n, s.l, s.m)}: empty in this configuration, ` +
                    `so the Hartree-Fock solve has no orbital for it`
              }
              onClick={() => setQuantumNumbers(s.n, s.l, s.m)}
            >
              {hasThumbnails ? (
                <img
                  src={thumbnailUrl(s.n, s.l, s.m, system, basis as Basis, 96)}
                  alt={stateLabel(s.n, s.l, s.m)}
                  width={72}
                  height={72}
                  loading="lazy"
                />
              ) : (
                <span className="thumb-blank" aria-hidden="true" />
              )}
              <span>{stateLabel(s.n, s.l, s.m)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
