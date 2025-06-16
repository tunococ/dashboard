import { describe, it, expect } from "vitest"; // Import Vitest functions
import { convert } from "../../src/utils/serialization";

function compareArrays(a: any, b: any) {
  for (let i = 0; i < Math.min(a.length, b.length); ++i) {
    if (a[i] < b[i]) {
      return -1;
    }
    if (a[i] > b[i]) {
      return 1;
    }
  }
  if (a.length < b.length) {
    return -1;
  }
  if (a.length > b.length) {
    return 1;
  }
  return 0;
}

describe("serialize", () => {
  it("should write to IndexedDB", async () => {

  })

})

describe("deserialize", () => {
  it("should read from IndexedDB", async () => {
  })
})


