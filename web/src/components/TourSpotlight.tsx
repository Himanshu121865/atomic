import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../state/store";
import { tourById } from "../tours/registry";
import { spotlightBox } from "../tours/spotlight";

const PAD = 6;

type Ring = ReturnType<typeof spotlightBox>;

function same(a: Ring, b: Ring): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function TourSpotlight() {
  const { tourId, stepIndex, sheet, setSheet } = useAppStore();
  const [box, setBox] = useState<Ring>(null);
  const boxRef = useRef<Ring>(null);
  const tour = tourId ? tourById(tourId) : null;
  const anchor = tour?.steps[stepIndex]?.spotlight ?? null;
  const openedFor = useRef<string | null>(null);

  const sync = useCallback(() => {
    const el = anchor ? document.querySelector(`[data-tour="${anchor}"]`) : null;
    if (el && openedFor.current !== anchor) {
      openedFor.current = anchor;
      if (el.closest(".mobile-sheet")) {
        if (useAppStore.getState().sheet === "collapsed") setSheet("half");
        el.scrollIntoView({ block: "center" });
      }
    }
    const buried =
      el !== null && sheet === "collapsed" && el.closest(".mobile-sheet") !== null;
    const next = el && !buried ? spotlightBox(el.getBoundingClientRect(), PAD) : null;
    if (same(boxRef.current, next)) return;
    boxRef.current = next;
    setBox(next);
  }, [anchor, sheet, setSheet]);

  useEffect(sync);

  useEffect(() => {
    if (!anchor) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      sync();
      second = requestAnimationFrame(sync);
    });
    const observer = new ResizeObserver(sync);
    if (document.body) observer.observe(document.body);
    const el = document.querySelector(`[data-tour="${anchor}"]`);
    if (el) observer.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [anchor, sync]);

  if (!box) return null;
  return (
    <div
      className="tour-ring"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      aria-hidden="true"
    />
  );
}
