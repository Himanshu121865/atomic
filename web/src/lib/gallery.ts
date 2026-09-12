export interface StateRef {
  n: number;
  l: number;
  m: number;
}

export function galleryStates(n: number): StateRef[] {
  const out: StateRef[] = [];
  for (let l = 0; l < n; l++) {
    for (let m = -l; m <= l; m++) out.push({ n, l, m: m + 0 });
  }
  return out;
}
