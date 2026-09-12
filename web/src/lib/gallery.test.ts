import { describe, expect, it } from "vitest";
import { galleryStates } from "./gallery";

describe("galleryStates", () => {
  it("enumerates all (l, m) of the shell in order", () => {
    expect(galleryStates(1)).toEqual([{ n: 1, l: 0, m: 0 }]);
    expect(galleryStates(2)).toHaveLength(4);
    expect(galleryStates(3)).toHaveLength(9);
    expect(galleryStates(2)[1]).toEqual({ n: 2, l: 1, m: -1 });
  });
});
