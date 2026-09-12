export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function spotlightBox(box: Box, pad: number) {
  if (box.width <= 0 || box.height <= 0) return null;
  return {
    x: box.left - pad,
    y: box.top - pad,
    w: box.width + 2 * pad,
    h: box.height + 2 * pad,
  };
}
