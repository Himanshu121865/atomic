import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { isZoomed, panView, zoomFactor, zoomView, type Domain } from "../lib/zoom";

export type ZoomAxis = {
  domain: Domain;
  range: Domain;
  log?: boolean;
};

export type PlotZoom = {
  x: [number, number];
  y: [number, number];
  zoomed: boolean;
  factor: number;
  dragging: boolean;
  reset: () => void;
  by: (factor: number) => void;
  /** Ref for the plot this zoom belongs to. */
  ref: (el: SVGSVGElement | null) => void;
  follower: (el: SVGSVGElement | null) => void;
  element: RefObject<SVGSVGElement | null>;
  handlers: {
    onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onDoubleClick: () => void;
  };
};

const WHEEL_IN = 1 / 1.18;
const WHEEL_OUT = 1.18;
const DRAG_SLOP = 3;

const FULL: [number, number] = [0, 1];

export function usePlotZoom(spec: {
  width: number;
  height: number;
  x?: ZoomAxis;
  y?: ZoomAxis;
}): PlotZoom {
  const { width, height, x: ax, y: ay } = spec;
  const element = useRef<SVGSVGElement | null>(null);
  const [xView, setXView] = useState<[number, number] | null>(null);
  const [yView, setYView] = useState<[number, number] | null>(null);
  const [dragging, setDragging] = useState(false);

  const key =
    `${ax?.domain[0]},${ax?.domain[1]},${ax?.log}|` +
    `${ay?.domain[0]},${ay?.domain[1]},${ay?.log}`;
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setXView(null);
    setYView(null);
  }

  const x = xView ?? (ax ? ([ax.domain[0], ax.domain[1]] as [number, number]) : FULL);
  const y = yView ?? (ay ? ([ay.domain[0], ay.domain[1]] as [number, number]) : FULL);

  const live = useRef({ ax, ay, x, y, width, height });
  live.current = { ax, ay, x, y, width, height };

  const zoomAbout = useCallback((factor: number, fx: number, fy: number) => {
    const { ax: cx, ay: cy } = live.current;
    if (cx) {
      setXView((prev) =>
        zoomView(prev ?? [cx.domain[0], cx.domain[1]], cx.domain, factor, fx, cx.log ?? false),
      );
    }
    if (cy) {
      setYView((prev) =>
        zoomView(prev ?? [cy.domain[0], cy.domain[1]], cy.domain, factor, fy, cy.log ?? false),
      );
    }
  }, []);

  const wheelRef = useCallback(
    (el: SVGSVGElement | null) => {
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        const s = live.current;
        if (!s.ax && !s.ay) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const vx = ((e.clientX - rect.left) / rect.width) * s.width;
        const vy = ((e.clientY - rect.top) / rect.height) * s.height;
        const frac = (v: number, r: Domain) => (v - r[0]) / (r[1] - r[0]);
        zoomAbout(
          e.deltaY > 0 ? WHEEL_OUT : WHEEL_IN,
          s.ax ? frac(vx, s.ax.range) : 0.5,
          s.ay ? frac(vy, s.ay.range) : 0.5,
        );
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    },
    [zoomAbout],
  );

  const ref = useCallback(
    (el: SVGSVGElement | null) => {
      element.current = el;
      const off = wheelRef(el);
      return () => {
        element.current = null;
        off?.();
      };
    },
    [wheelRef],
  );

  const drag = useRef<{ id: number; cx: number; cy: number; moved: boolean } | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, moved: false };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const el = e.currentTarget;
    if (!d || d.id !== e.pointerId) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const s = live.current;
    const dx = ((e.clientX - d.cx) / rect.width) * s.width;
    const dy = ((e.clientY - d.cy) / rect.height) * s.height;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      d.moved = true;
      setDragging(true);
      el.setPointerCapture(e.pointerId);
    }
    d.cx = e.clientX;
    d.cy = e.clientY;
    const { ax: cx, ay: cy } = s;
    if (cx) {
      const span = cx.range[1] - cx.range[0];
      if (span !== 0) {
        setXView((prev) =>
          panView(prev ?? [cx.domain[0], cx.domain[1]], cx.domain, -dx / span, cx.log ?? false),
        );
      }
    }
    if (cy) {
      const span = cy.range[1] - cy.range[0];
      if (span !== 0) {
        setYView((prev) =>
          panView(prev ?? [cy.domain[0], cy.domain[1]], cy.domain, -dy / span, cy.log ?? false),
        );
      }
    }
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drag.current = null;
    setDragging(false);
  }, []);

  const reset = useCallback(() => {
    setXView(null);
    setYView(null);
  }, []);

  const factor = Math.max(
    ax ? zoomFactor(x, ax.domain, ax.log ?? false) : 1,
    ay ? zoomFactor(y, ay.domain, ay.log ?? false) : 1,
  );

  return {
    x,
    y,
    zoomed:
      (ax !== undefined && isZoomed(x, ax.domain, ax.log ?? false)) ||
      (ay !== undefined && isZoomed(y, ay.domain, ay.log ?? false)),
    factor,
    dragging,
    reset,
    by: (f: number) => zoomAbout(f, 0.5, 0.5),
    ref,
    follower: wheelRef,
    element,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onDoubleClick: reset,
    },
  };
}

export function ZoomControls({
  zoom,
  what = "the plot",
}: {
  zoom: PlotZoom;
  what?: string;
}) {
  return (
    <div className="zoom-bar">
      <div className="zoom-buttons">
        <button
          type="button"
          onClick={() => zoom.by(WHEEL_IN * WHEEL_IN)}
          aria-label="zoom in"
          title="zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoom.by(WHEEL_OUT * WHEEL_OUT)}
          aria-label="zoom out"
          disabled={!zoom.zoomed}
          title="zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={zoom.reset}
          disabled={!zoom.zoomed}
          title="back to the full range"
        >
          reset
        </button>
      </div>
      <span className="zoom-state">
        {zoom.zoomed ? (
          <>
            <strong>{zoom.factor.toFixed(1)}×</strong> on {what}
          </>
        ) : (
          <>scroll to zoom {what}, drag to pan, double-click to reset</>
        )}
      </span>
    </div>
  );
}

export function OffWindowMarks({
  above,
  below,
  x,
  top,
  bottom,
  noun,
}: {
  above: number;
  below: number;
  x: number;
  top: number;
  bottom: number;
  noun: string;
}) {
  const plural = (n: number) => (n === 1 ? noun : `${noun}s`);
  return (
    <>
      {above > 0 && (
        <text x={x} y={top} className="tick off-window">
          {`\u2191 ${above} more ${plural(above)} above this window`}
        </text>
      )}
      {below > 0 && (
        <text x={x} y={bottom} className="tick off-window">
          {`\u2193 ${below} more ${plural(below)} below this window`}
        </text>
      )}
    </>
  );
}
