import { describe, expect, it } from "vitest"; // Import Vitest functions
import {
  convert,
  deleteAttributeAtPath,
  getAttributeAtPath,
  hasAttributeAtPath,
  setAttributeAtPath,
} from "../../src/utils/serialization";

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
        compareArrays(digits, expected.reverse()) === 0,
    );

    const num = convert(arrayBuffer, "number");
    expect(num).toBe(1);
  });

  it("should convert between boolean and ArrayBuffer", () => {
    const arrayBuffer = convert(true, "arraybuffer");
    const value = new Uint8Array(arrayBuffer)[0];
    expect(value).toBe(1);

    const bool = convert(arrayBuffer, "boolean");
    expect(bool).toBe(true);
  });

  it("should convert between string and ArrayBuffer", () => {
    const text = "Hello, world!";
    const arrayBuffer = convert(text, "arraybuffer");
    const value = String.fromCharCode(...new Uint8Array(arrayBuffer));
    expect(value).toBe(text);

    const str = convert(arrayBuffer, "string");
    expect(str).toBe(text);
  });

  it("should convert between object and ArrayBuffer", () => {
    const obj = ["a", { b: ["c", "d"], e: 0 }, 1];
    const arrayBuffer = convert(obj, "arraybuffer");
    const recovered = convert(arrayBuffer, "object");
    expect(obj).toStrictEqual(recovered);
  });

  it("should convert between boolean and number", () => {
    expect(convert(60, "boolean")).toBe(true);
    expect(convert(0, "boolean")).toBe(false);
    expect(convert(-0, "boolean")).toBe(false);
    expect(convert(Number.NaN, "boolean")).toBe(false);
    expect(convert(Number.NEGATIVE_INFINITY, "boolean")).toBe(true);

    expect(convert(false, "number")).toBe(0);
    expect(convert(true, "number")).toBe(1);
  });

  it("should convert between boolean and string", () => {
    expect(convert("false", "boolean")).toBe(false);
    expect(convert("true", "boolean")).toBe(true);
    expect(convert("tru", "boolean")).toBe(false);
    expect(convert("", "boolean")).toBe(false);

    expect(convert(false, "string")).toBe("false");
    expect(convert(true, "string")).toBe("true");
  });

  it("should convert between number and string", () => {
    expect(convert("13579", "number")).toBe(13579);
    expect(convert("NaN", "number")).toBe(Number.NaN);
    expect(convert("-0", "number")).toBe(-0);
    expect(convert("-0", "number")).not.toBe(0);
    expect(convert(-0, "string")).toBe("-0");
    expect(convert(+0, "string")).toBe("0");
    expect(convert(-13579, "string")).toBe("-13579");
  });

  it("should convert between string and object", () => {
    const obj = ["a", { b: ["c", "d"], e: 0 }, 1];
    const str = convert(obj, "string");
    expect(str).toBe(JSON.stringify(obj));
    const recovered = convert(str, "object");
    expect(obj).toStrictEqual(recovered);

    const nullStr = convert(null, "string");
    expect(nullStr).toBe("null");
  });

  it("should convert string to Blob", async () => {
    const text = "Hello, world!";
    const arrayBuffer = convert(text, "arraybuffer");
    const blob = convert(text, "blob");

    const blobBuffer = await blob.arrayBuffer();
    expect(arrayBuffer).toStrictEqual(blobBuffer);
  });

  it("should override Blob's MIME type if desired", async () => {
    const text = "Hello, world!";
    const blob = convert(text, "blob", { mimeType: "abc" });
    expect(blob.type).toBe("abc");
  });
});

describe("hasAttributeAtPath", () => {
  it("returns false if value is empty", () => {
    expect(hasAttributeAtPath(null, undefined)).toBe(false);
    expect(hasAttributeAtPath(undefined, undefined)).toBe(false);
    expect(hasAttributeAtPath(null, "")).toBe(false);
    expect(hasAttributeAtPath(undefined, "")).toBe(false);
    expect(hasAttributeAtPath(null, "a")).toBe(false);
    expect(hasAttributeAtPath(undefined, "a")).toBe(false);
    expect(hasAttributeAtPath(null, "a.b")).toBe(false);
    expect(hasAttributeAtPath(undefined, "a.b")).toBe(false);
  });

  it("returns true if path is empty and value is not", () => {
    expect(hasAttributeAtPath({ a: 1 }, undefined)).toBe(true);
    expect(hasAttributeAtPath([], undefined)).toBe(true);
  });

  it("returns true if and only if value contains a value at path", () => {
    const value = {
      a: ["zero", "one", "two"],
      b: 2,
      d: {},
      s: "",
      n: null,
      u: undefined,
    };
    expect(hasAttributeAtPath(value, "a")).toBe(true);
    expect(hasAttributeAtPath(value, "b")).toBe(true);
    expect(hasAttributeAtPath(value, "d")).toBe(true);
    expect(hasAttributeAtPath(value, "s")).toBe(true);
    expect(hasAttributeAtPath(value, "n")).toBe(true);
    expect(hasAttributeAtPath(value, "u")).toBe(true);
    expect(hasAttributeAtPath(value, "v")).toBe(false);
    expect(hasAttributeAtPath(value, "a.0")).toBe(true);
    expect(hasAttributeAtPath(value, "a.1")).toBe(true);
    expect(hasAttributeAtPath(value, "a.2")).toBe(true);
    expect(hasAttributeAtPath(value, "a.3")).toBe(false);
  });
});

describe("getAttributeAtPath", () => {
  it("returns undefined if value is empty", () => {
    expect(getAttributeAtPath(null, undefined)).toBeUndefined;
    expect(getAttributeAtPath(undefined, undefined)).toBeUndefined;
    expect(getAttributeAtPath(null, "")).toBeUndefined;
    expect(getAttributeAtPath(undefined, "")).toBeUndefined;
    expect(getAttributeAtPath(null, "a")).toBeUndefined;
    expect(getAttributeAtPath(undefined, "a")).toBeUndefined;
    expect(getAttributeAtPath(null, "a.b")).toBeUndefined;
    expect(getAttributeAtPath(undefined, "a.b")).toBeUndefined;
  });

  it("returns value if path is empty", () => {
    const value1 = { a: 1 };
    expect(getAttributeAtPath(value1, undefined)).toBe(value1);

    const value2 = [1, 2, 3, 4, 5];
    expect(getAttributeAtPath(value2, undefined)).toBe(value2);
  });

  it("returns the value at the given path inside the input value", () => {
    const value: any = {
      a: ["zero", "one", "two"],
      b: 2,
      d: {},
      s: "",
      n: null,
      u: undefined,
    };
    expect(getAttributeAtPath(value, "a")).toBe(value.a);
    expect(getAttributeAtPath(value, "b")).toBe(value.b);
    expect(getAttributeAtPath(value, "d")).toBe(value.d);
    expect(getAttributeAtPath(value, "s")).toBe(value.s);
    expect(getAttributeAtPath(value, "n")).toBe(value.n);
    expect(getAttributeAtPath(value, "u")).toBe(value.u);
    expect(getAttributeAtPath(value, "v")).toBe(value.v);
    expect(getAttributeAtPath(value, "a.0")).toBe(value.a[0]);
    expect(getAttributeAtPath(value, "a.1")).toBe(value.a[1]);
    expect(getAttributeAtPath(value, "a.2")).toBe(value.a[2]);
    expect(getAttributeAtPath(value, "a.3")).toBe(value.a[3]);
  });
});

describe("setAttributeAtPath", () => {
  it("sets the value at the given path inside the input value", () => {
    const value = {};
    expect(setAttributeAtPath(value, "a", [])).toStrictEqual({ a: [] });
    expect(setAttributeAtPath(value, "a.0", "zero")).toStrictEqual({
      a: ["zero"],
    });
    expect(setAttributeAtPath(value, "a.1", "one")).toStrictEqual({
      a: ["zero", "one"],
    });
    expect(setAttributeAtPath(value, "a.2", "two")).toStrictEqual({
      a: ["zero", "one", "two"],
    });
    expect(setAttributeAtPath(value, "b", 2)).toStrictEqual({
      a: ["zero", "one", "two"],
      b: 2,
    });
    expect(setAttributeAtPath(value, "s", "")).toStrictEqual({
      a: ["zero", "one", "two"],
      b: 2,
      s: "",
    });
    expect(setAttributeAtPath(value, "s", "something")).toStrictEqual({
      a: ["zero", "one", "two"],
      b: 2,
      s: "something",
    });
    expect(setAttributeAtPath(value, "n", null)).toStrictEqual({
      a: ["zero", "one", "two"],
      b: 2,
      s: "something",
      n: null,
    });
    expect(setAttributeAtPath(value, "u", undefined)).toStrictEqual({
      a: ["zero", "one", "two"],
      b: 2,
      s: "something",
      n: null,
      u: undefined,
    });
    expect(setAttributeAtPath(value, "a", "replaced")).toStrictEqual({
      a: "replaced",
      b: 2,
      s: "something",
      n: null,
      u: undefined,
    });
  });
});

describe("deleteAttributeAtPath", () => {
  it("deletes the value at the given path inside the input value if it exists", () => {
    const expectedValue: any = {
      a: ["zero", "one", "two"],
      b: 2,
      d: {},
      s: "",
      n: null,
      u: undefined,
    };
    const value = structuredClone(expectedValue);

    expect(deleteAttributeAtPath(value, "c")).toStrictEqual(expectedValue);
    expect(deleteAttributeAtPath(value, "a.4")).toStrictEqual(expectedValue);

    delete expectedValue.a[1];
    expect(deleteAttributeAtPath(value, "a.1")).toStrictEqual(expectedValue);

    expect(hasAttributeAtPath(value, "n")).toBe(true);
    expect(getAttributeAtPath(value, "n")).toBe(null);
    expect(hasAttributeAtPath(value, "u")).toBe(true);
    expect(getAttributeAtPath(value, "u")).toBe(undefined);

    delete expectedValue.n;
    expect(deleteAttributeAtPath(value, "n")).toStrictEqual(expectedValue);
    expect(hasAttributeAtPath(value, "n")).toBe(false);
    expect(getAttributeAtPath(value, "n")).toBe(undefined);

    delete expectedValue.u;
    expect(deleteAttributeAtPath(value, "u")).toStrictEqual(expectedValue);
    expect(hasAttributeAtPath(value, "u")).toBe(false);
    expect(getAttributeAtPath(value, "u")).toBe(undefined);

    delete expectedValue.a;
    expect(deleteAttributeAtPath(value, "a")).toStrictEqual(expectedValue);
    expect(hasAttributeAtPath(value, "a")).toBe(false);
    expect(getAttributeAtPath(value, "a")).toBe(undefined);
  });
});
