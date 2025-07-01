import { describe, expect, it } from "vitest"; // Import Vitest functions
import { sum } from "../../src/utils/geometry-2d.ts";

describe("sum", () => {
  it("returns correct sum", () => {
    expect(sum({ x: 1, y: 2 }, { x: -2, y: 3 })).toStrictEqual({ x: -1, y: 5 });
  });
});
