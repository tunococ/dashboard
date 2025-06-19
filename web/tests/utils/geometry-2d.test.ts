import { describe, it, expect } from "vitest"; // Import Vitest functions
import { sum } from "../../src/utils/geometry-2d.ts";

describe("sum", () => {
  it("returns correct sum", () => {
    expect(sum({ x: 1, y: 2 }, { x: -2, y: 3 })).toEqual({ x: -1, y: 5 });
  })
})

