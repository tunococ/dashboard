import { afterAll, beforeAll, describe, expect, it } from "vitest"; // Import Vitest functions
import {
  type IDBLocation,
  type OpfsLocation,
  addIDBValue,
  clearIDBStore,
  deleteFromStorage,
  deleteIDBValue,
  deserialize,
  getIDBValue,
  initIDBStores,
  serialize,
  setIDBValue,
} from "../../src/browser-utils/serialization";
import type { DataType } from "../../src/utils/serialization";

describe("IndexedDB convenience functions", () => {
  const dbName = "ConvenienceFunctions";
  const storeName1 = "IDBBasicTest1";
  const keyPath1 = "key";
  const storeName2 = "IDBBasicTest2";
  const keyPath2 = "time.created";

  function storeFunctions(dbName: string, storeName: string) {
    return {
      get: (key: string, valuePath?: string) =>
        getIDBValue(dbName, storeName, key, valuePath),
      put: (key: string, valuePath: string | undefined, value: any) =>
        setIDBValue(dbName, storeName, key, valuePath, value),
      add: (key: string, valuePath: string | undefined, value: any) =>
        addIDBValue(dbName, storeName, key, valuePath, value),
      delete: (key: string, valuePath?: string) =>
        deleteIDBValue(dbName, storeName, key, valuePath),
    };
  }

  const {
    get: get1,
    put: put1,
    add: add1,
    delete: delete1,
  } = storeFunctions(dbName, storeName1);
  const {
    get: get2,
    put: put2,
    add: add2,
    delete: delete2,
  } = storeFunctions(dbName, storeName2);

  beforeAll(async () => {
    await initIDBStores(dbName, [
      {
        name: storeName1,
        keyPath: keyPath1,
      },
      {
        name: storeName2,
        keyPath: keyPath2,
      },
    ]);
  });

  afterAll(async () => {
    await clearIDBStore(dbName, [storeName1, storeName2]);
  });

  it("get should return undefined when non-existing value is retrieved", async () => {
    await expect(
      put1("food", "dinner", ["Broiled broccoli", "Shoyu and pepper rice"]),
    ).resolves.toBe(true);
    await expect(put1("food", "lunch", "Potato salad")).resolves.toBe(false);
    await expect(
      put1("food", "breakfast", [
        "Omlette",
        "Peanut butter and jelly sandwich",
      ]),
    ).resolves.toBe(false);
    expect(await get1("food", "dinner.1")).toBe("Shoyu and pepper rice");
    expect(await get1("food", "dinner.2")).toBeUndefined();
    expect(await get1("medicine")).toBeUndefined();
  });

  it("get and put should work with nested values", async () => {
    await expect(put1("farewell", "phrases.0", "Goodbye.")).resolves.toBe(true);
    await expect(put1("farewell", "phrases.1", "See you later.")).resolves.toBe(
      false,
    );
    await expect(put1("farewell", "phrases.2", "Take care.")).resolves.toBe(
      false,
    );
    expect(await get1("farewell")).toStrictEqual({
      key: "farewell",
      phrases: {
        0: "Goodbye.",
        1: "See you later.",
        2: "Take care.",
      },
    });
    expect(await get1("farewell", "phrases.0")).toBe("Goodbye.");
    expect(await get1("farewell", "phrases.1")).toBe("See you later.");

    await expect(
      put1("dialog", "speeches", [
        { speaker: "John", text: "Hi there. Good to see you today." },
        { speaker: "Jane", text: "Hey. Good to see you too. How are you?" },
        {
          speaker: "John",
          text: "I'm great. Thanks for asking. How about you?",
        },
        { speaker: "Jane", text: "I'm doing well too." },
      ]),
    ).resolves.toBe(true);
    expect(await get1("dialog", "speeches.2.speaker")).toBe("John");
    expect(await get1("dialog", "speeches.3.text")).toBe("I'm doing well too.");
  });

  it("put should replace and existing value with the same key", async () => {
    await expect(put1("greeting", "first", "Hello.")).resolves.toBe(true);
    await expect(put1("greeting", "second", "How are you?")).resolves.toBe(
      false,
    );
    expect(await get1("greeting")).toStrictEqual({
      key: "greeting",
      first: "Hello.",
      second: "How are you?",
    });

    await expect(put1("greeting", "first", "Hi!")).resolves.toBe(false);
    expect(await get1("greeting")).toStrictEqual({
      key: "greeting",
      first: "Hi!",
      second: "How are you?",
    });
    expect(await get1("greeting", "key")).toBe("greeting");
    expect(await get1("greeting", "first")).toBe("Hi!");
    expect(await get1("greeting", "second")).toBe("How are you?");
  });

  it("get and put should work with nested keys", async () => {
    await expect(put2("00:00:00", "time.finished", "00:01:00")).resolves.toBe(
      true,
    );
    await expect(put2("00:00:00", "task", "Wash hands")).resolves.toBe(false);
    await expect(put2("00:01:00", "time.finished", "00:01:20")).resolves.toBe(
      true,
    );
    expect(await get2("00:00:00")).toStrictEqual({
      time: {
        created: "00:00:00",
        finished: "00:01:00",
      },
      task: "Wash hands",
    });
    expect(await get2("00:00:00", "task")).toStrictEqual("Wash hands");
    expect(await get2("00:01:00", "time.finished")).toStrictEqual("00:01:20");
  });

  it("put should add a new entry with the given key if the value path is empty", async () => {
    const value1 = {
      time: {
        created: "00:02:00",
      },
    };
    await expect(put2("00:02:00", undefined, value1)).resolves.toBe(true);
    expect(await get2("00:02:00")).toStrictEqual(value1);

    const value2 = {
      0: "zero",
    };
    await expect(put2("00:02:01", undefined, value2)).resolves.toBe(true);
    expect(await get2("00:02:01")).toStrictEqual({
      ...value2,
      time: { created: "00:02:01" },
    });
  });

  it("put should always keep the value at the key path equal to key", async () => {
    const value1 = {
      time: {
        created: "00:02:00",
      },
      1: "one",
    };
    await expect(put2("00:02:02", undefined, value1)).resolves.toBe(true);
    expect(await get2("00:02:02")).toStrictEqual({
      time: {
        created: "00:02:02",
      },
      1: "one",
    });

    const value2 = {
      time: {
        created: {
          maybe: "not sure",
        },
      },
      2: "two",
    };
    await expect(put2("00:02:03", undefined, value2)).resolves.toBe(true);
    expect(await get2("00:02:03")).toStrictEqual({
      time: {
        created: "00:02:03",
      },
      2: "two",
    });

    await expect(
      put2("00:02:03", "time", {
        created: "unknown",
        modified: "00:02:10",
      }),
    ).resolves.toBe(false);
    expect(await get2("00:02:03")).toStrictEqual({
      time: {
        created: "00:02:03",
        modified: "00:02:10",
      },
      2: "two",
    });
  });

  it("add should not modify existing values", async () => {
    await expect(add1("animals", "0", "dog")).resolves.toBe(true);
    await expect(add1("animals", "1", "cat")).resolves.toBe(false);
    expect(await get1("animals")).toStrictEqual({
      key: "animals",
      0: "dog",
      1: "cat",
    });
    await expect(add1("animals", "0", "deer")).rejects.toThrow();
    await expect(add1("animals", "zoo", [])).resolves.toBe(false);
  });

  it("delete should remove a nested value from an existing item", async () => {
    const value = {
      time: {
        created: "00:03:00",
      },
      first: "1",
      second: {
        "2-1": "one",
        "2-100": "hundred",
      },
    };
    await expect(add2("00:03:00", undefined, value)).resolves.toBe(true);
    expect(await get2("00:03:00")).toStrictEqual(value);

    await expect(delete2("00:03:00", "second.2-1")).resolves.toBe(true);
    expect(await get2("00:03:00")).toBeUndefined;

    await expect(delete2("00:03:00", "second.2-1")).resolves.toBe(false);
  });

  it("delete should not remove the key unless value path is undefined", async () => {
    const value = {
      elements: {
        chemistry: {
          hydrogen: 1,
          helium: 2,
          lithium: 3,
        },
        art: {
          earth: 1,
          fire: 4,
          water: 2,
          air: 3,
          plasma: undefined,
        },
      },
    };
    await expect(add1("things", undefined, value)).resolves.toBe(true);
    expect(await get1("things", "key")).toBe("things");
    expect(await get1("things", "elements")).toStrictEqual(value.elements);

    // Try to remove a non-existent value.
    await expect(delete1("things", "elements.art.metal")).resolves.toBe(false);
    expect(await get1("things", "elements")).toStrictEqual(value.elements);

    // Try to remove a value that is "undefined".
    await expect(delete1("things", "elements.art.plasma")).resolves.toBe(true);
    // Note that toEqual will ignore undefined values in an object, so
    // art.plasma having a value of "undefined" is treated the same as
    // art.plasma not being defined.
    expect(await get1("things", "elements")).toEqual(value.elements);

    // Try to remove the key.
    await expect(delete1("things", "key")).resolves.toBe(false);
    // Nothing should change.
    expect(await get1("things", "elements")).toEqual(value.elements);

    // Try to remove the whole entry.
    await expect(delete1("things")).resolves.toBe(true);
    expect(await get1("things", "elements")).toBeUndefined;
    expect(await get1("things")).toBeUndefined;
  });
});

async function expectStrictEqual(v1: any, v2: any) {
  if (typeof v1 === "object") {
    if (v1 instanceof Blob) {
      const a1 = Array.from(new Uint8Array(await v1.arrayBuffer()));
      const a2 = Array.from(new Uint8Array(await v2.arrayBuffer()));
      expect(a1).toStrictEqual(a2);
    } else {
      expect(v1).toStrictEqual(v2);
    }
  } else {
    expect(v1).toBe(v2);
  }
}

describe("IndexedDB serialization", () => {
  const dbName = "Serialization";
  const storeName = "IDBTest";
  const keyPath = "key";
  const valuePath = "value";
  const location0: IDBLocation = {
    type: "idb",
    dbName,
    storeName,
    keyPath,
    valuePath,
    key: "",
  };

  beforeAll(async () => {
    await initIDBStores(dbName, [
      {
        name: storeName,
        keyPath,
      },
    ]);
  });

  afterAll(async () => {
    await clearIDBStore(dbName, [storeName]);
  });

  describe("serialize and deserialize", () => {
    it("are inverses of each other", async () => {
      const pairs: [string, any][] = [
        ["string:greeting", "Hello, world!"],
        ["string:question", "How are you?"],
        ["string:empty", ""],
        ["boolean:false", false],
        ["boolean:true", true],
        ["number:0", 0],
        ["number:1", 1],
        ["number:-1", -1],
        ["number:NaN", Number.NaN],
        ["number:-NaN", -Number.NaN],
        ["number:Infinity", Number.POSITIVE_INFINITY],
        ["number:-0", -0],
        ["number:-Infinity", Number.NEGATIVE_INFINITY],
        ["object:null", null],
        ["object:array", [1, 2, 3]],
        ["object:nestedInArray", [1, [2, 3], { d: 4, e: [5, 6] }]],
        ["object:nestedObject", { a: 1, b: { c: [3, 4, 5], d: null } }],
        ["arraybuffer:empty", new ArrayBuffer(0)],
        ["arraybuffer:10bytes", new Uint16Array([1, 2, 3, 4, 5]).buffer],
        ["blob:empty", new Blob([])],
        ["blob:10bytes", new Blob([new Uint16Array([1, 2, 3, 4, 5]).buffer])],
      ];

      for (const [key, value] of pairs) {
        const location = { ...location0, key };
        const type = key.split(":", 1)[0];
        await serialize(value, location);
        expectStrictEqual(await deserialize(location, type as DataType), value);
      }
    });
  });

  describe("deleteFromStorage", () => {
    it("should return false if the specified location doesn't have data", async () => {
      const location = { ...location0, key: "something new" };
      expect(await deleteFromStorage(location)).toBe(false);
    });

    it("should return true if the specified location has data", async () => {
      const location = { ...location0, key: "something else" };
      const value = {
        a: "a",
        b: "b",
        c: "c",
        d: {
          da: "da",
          db: "db",
          dc: "dc",
          dd: {
            dda: 1,
            ddb: 2,
            ddc: 3,
          },
        },
      };
      await serialize(value, location);
      expectStrictEqual(await deserialize(location, "object"), value);

      const locationInner = {
        ...location,
        valuePath: location.valuePath + ".d.dd",
      };
      expect(await deserialize(locationInner, "object")).toStrictEqual({
        dda: 1,
        ddb: 2,
        ddc: 3,
      });

      await deleteFromStorage(locationInner);
      await expect(deserialize(locationInner, "object")).rejects.toThrow();

      locationInner.valuePath = location.valuePath + ".d";
      expect(await deserialize(locationInner, "object")).toStrictEqual({
        da: "da",
        db: "db",
        dc: "dc",
      });
      expect(await deserialize(location, "object")).toStrictEqual({
        a: "a",
        b: "b",
        c: "c",
        d: {
          da: "da",
          db: "db",
          dc: "dc",
        },
      });

      await deleteFromStorage(location);
      await expect(deserialize(location, "object")).rejects.toThrow();
    });
  });
});

describe("OPFS serialization", () => {
  const baseDir = "OPFSTest";
  const location0: OpfsLocation = {
    type: "opfs",
    path: [],
  };

  describe("serialize and deserialize", () => {
    it("are inverses of each other", async () => {
      const pairs: [string, any][] = [
        ["string:greeting", "Hello, world!"],
        ["string:question", "How are you?"],
        ["string:empty", ""],
        ["boolean:false", false],
        ["boolean:true", true],
        ["number:0", 0],
        ["number:1", 1],
        ["number:-1", -1],
        ["number:NaN", Number.NaN],
        ["number:-NaN", -Number.NaN],
        ["number:Infinity", Number.POSITIVE_INFINITY],
        ["number:-0", -0],
        ["number:-Infinity", Number.NEGATIVE_INFINITY],
        ["object:null", null],
        ["object:array", [1, 2, 3]],
        ["object:nestedInArray", [1, [2, 3], { d: 4, e: [5, 6] }]],
        ["object:nestedObject", { a: 1, b: { c: [3, 4, 5], d: null } }],
        ["arraybuffer:empty", new ArrayBuffer(0)],
        ["arraybuffer:10bytes", new Uint16Array([1, 2, 3, 4, 5]).buffer],
        ["blob:empty", new Blob([])],
        ["blob:10bytes", new Blob([new Uint16Array([1, 2, 3, 4, 5]).buffer])],
      ];

      for (const [key, value] of pairs) {
        const path = [baseDir, ...key.split(":")];
        const type = path[1];
        const location = { ...location0, path };
        await serialize(value, location);
        expectStrictEqual(await deserialize(location, type as DataType), value);
      }
    });
  });
});
