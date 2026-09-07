type RGB = [number, number, number];

const INFERNO: [number, RGB][] = [
  [0.0, [0, 0, 4]],
  [0.13, [31, 12, 72]],
  [0.25, [85, 15, 109]],
  [0.38, [136, 34, 106]],
  [0.5, [186, 54, 85]],
  [0.63, [227, 89, 51]],
  [0.75, [249, 140, 10]],
  [0.88, [249, 201, 50]],
  [1.0, [252, 255, 164]],
];

const BLUE: RGB = [59, 76, 192];
const RED: RGB = [180, 40, 40];

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function inferno(t: number): RGB {
  const x = clamp01(t);
  for (let i = 1; i < INFERNO.length; i++) {
    if (x <= INFERNO[i][0]) {
      const [x0, c0] = INFERNO[i - 1];
      const [x1, c1] = INFERNO[i];
      return lerp(c0, c1, (x - x0) / (x1 - x0));
    }
  }
  return INFERNO[INFERNO.length - 1][1];
}

export function densityColor(t: number, gamma = 0.5): RGB {
  return inferno(Math.pow(clamp01(t), gamma));
}

export function phaseColor(angle: number, brightness: number): RGB {
  const t = ((angle + Math.PI) / (2 * Math.PI)) % 1;
  const v = clamp01(brightness);
  return lerp(BLUE, RED, t).map((c) => c * v) as RGB;
}

export function toByte(c: RGB): [number, number, number] {
  return [Math.round(clamp01(c[0] / 255) * 255), Math.round(clamp01(c[1] / 255) * 255), Math.round(clamp01(c[2] / 255) * 255)];
}
