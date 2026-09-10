import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { viewBoxX } from "../lib/hover";
import { mathTspans } from "../lib/mathText";

export function usePlotHover(
  viewBoxWidth: number,
  shared?: RefObject<SVGSVGElement | null>,
) {
  const own = useRef<SVGSVGElement | null>(null);
  const ref = shared ?? own;
  const [x, setX] = useState<number | null>(null);
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const el = ref.current;
      if (!el) return;
      setX(viewBoxX(e.clientX, el.getBoundingClientRect(), viewBoxWidth));
    },
    [viewBoxWidth],
  );
  const onPointerLeave = useCallback(() => setX(null), []);
  return { ref, x, onPointerMove, onPointerLeave };
}

export function HoverReadout({
  px,
  py,
  top,
  bottom,
  lines,
  width,
  rightMargin,
}: {
  px: number;
  py: number | null;
  top: number;
  bottom: number;
  lines: string[];
  width: number;
  rightMargin: number;
}) {
  const boxW = Math.max(...lines.map((s) => s.length)) * 5.6 + 12;
  const boxH = lines.length * 12 + 8;
  const flip = px + boxW + 10 > width - rightMargin;
  const bx = flip ? px - boxW - 8 : px + 8;
  const by = Math.min(Math.max(py ?? top, top), bottom - boxH);
  return (
    <g className="hover-layer" pointerEvents="none">
      <line x1={px} x2={px} y1={top} y2={bottom} className="hover-line" />
      {py !== null && <circle cx={px} cy={py} r={3} className="hover-dot" />}
      <rect x={bx} y={by} width={boxW} height={boxH} rx={2} className="hover-box" />
      {lines.map((text, i) => (
        <text key={text} x={bx + 6} y={by + 13 + i * 12} className="tick hover-text">
          {mathTspans(text)}
        </text>
      ))}
    </g>
  );
}
