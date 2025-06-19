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

describe("convert function", () => {

  it("should convert between number and ArrayBuffer", () => {
    const arrayBuffer = convert(1, "arraybuffer");
    const digits = Array.from(new Uint8Array(arrayBuffer));
    const expected = [0x3f, 0xf0, 0, 0, 0, 0, 0, 0];
    expect(
      compareArrays(digits, expected) === 0 ||
      compareArrays(digits, expected.reverse()) === 0
    );

    const num = convert(arrayBuffer, "number");
    expect(num).toBe(1);
  })

  it("should convert between boolean and ArrayBuffer", () => {
    const arrayBuffer = convert(true, "arraybuffer");
    const value = (new Uint8Array(arrayBuffer))[0];
    expect(value).toBe(1);

    const bool = convert(arrayBuffer, "boolean");
    expect(bool).toBe(true);
  })

  it("should convert between string and ArrayBuffer", () => {
    const text = "Hello, world!";
    const arrayBuffer = convert(text, "arraybuffer");
    const value = String.fromCharCode(...(new Uint8Array(arrayBuffer)));
    expect(value).toBe(text);

    const str = convert(arrayBuffer, "string");
    expect(str).toBe(text);
  })

  it("should convert between object and ArrayBuffer", () => {
    const obj = ["a", { "b": ["c", "d"], "e": 0 }, 1];
    const arrayBuffer = convert(obj, "arraybuffer");
    const recovered = convert(arrayBuffer, "object");
    expect(obj).toEqual(recovered);
  })

  it("should convert between boolean and number", () => {
    expect(convert(60, "boolean")).toBe(true);
    expect(convert(0, "boolean")).toBe(false);
    expect(convert(-0, "boolean")).toBe(false);
    expect(convert(NaN, "boolean")).toBe(false);
    expect(convert(-Infinity, "boolean")).toBe(true);

    expect(convert(false, "number")).toBe(0);
    expect(convert(true, "number")).toBe(1);
  })

  it("should convert between boolean and string", () => {
    expect(convert("false", "boolean")).toBe(false);
    expect(convert("true", "boolean")).toBe(true);
    expect(convert("tru", "boolean")).toBe(false);
    expect(convert("", "boolean")).toBe(false);

    expect(convert(false, "string")).toBe("false");
    expect(convert(true, "string")).toBe("true");
  })

  it("should convert between number and string", () => {
    expect(convert("13579", "number")).toBe(13579);
    expect(convert("NaN", "number")).toBe(NaN);
    expect(convert("-0", "number")).toBe(-0);
    expect(convert("-0", "number")).not.toBe(0);
    expect(convert(-0, "string")).toBe("-0");
    expect(convert(+0, "string")).toBe("0");
    expect(convert(-13579, "string")).toBe("-13579");
  })

  it("should convert between string and object", () => {
    const obj = ["a", { "b": ["c", "d"], "e": 0 }, 1];
    const str = convert(obj, "string");
    expect(str).toBe(JSON.stringify(obj));
    const recovered = convert(str, "object");
    expect(obj).toEqual(recovered);

    const nullStr = convert(null, "string");
    expect(nullStr).toBe("null");
  })

  it("should convert string to Blob", async () => {
    const text = "Hello, world!";
    const arrayBuffer = convert(text, "arraybuffer");
    const blob = convert(text, "blob");

    const blobBuffer = await blob.arrayBuffer();
    expect(arrayBuffer).toEqual(blobBuffer);
  })

  it("should override Blob's MIME type if desired", async () => {
    const text = "Hello, world!";
    const blob = convert(text, "blob", { mimeType: "abc" });
    expect(blob.type).toBe("abc");
  })

})


