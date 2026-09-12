import { describe, expect, it } from "vitest";
import { decodeFloats, decodeIndices, decodePositions } from "./client";

describe("decodePositions", () => {
  it("decodes interleaved xyz float32", () => {
    const src = new Float32Array([1, 2, 3, 4, 5, 6]);
    const out = decodePositions(src.buffer);
    expect(out).toHaveLength(6);
    expect(out[4]).toBe(5);
  });
  it("rejects buffers that are not whole xyz triplets", () => {
    expect(() => decodePositions(new ArrayBuffer(10))).toThrow(/multiple of 12/);
  });
});

describe("decodeFloats", () => {
  it("decodes float32 buffers", () => {
    const buf = new Float32Array([1.5, -2.5]).buffer;
    expect(Array.from(decodeFloats(buf))).toEqual([1.5, -2.5]);
  });
  it("rejects lengths that are not multiples of 4", () => {
    expect(() => decodeFloats(new ArrayBuffer(5))).toThrow(/multiple of 4/);
  });
});

describe("decodeIndices", () => {
  it("decodes triangle uint32 buffers", () => {
    const buf = new Uint32Array([0, 1, 2]).buffer;
    expect(Array.from(decodeIndices(buf))).toEqual([0, 1, 2]);
  });
  it("rejects lengths that are not whole triangles", () => {
    expect(() => decodeIndices(new ArrayBuffer(8))).toThrow(/multiple of 12/);
  });
});
