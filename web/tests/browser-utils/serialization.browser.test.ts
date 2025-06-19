import { describe, it, expect, beforeAll, afterAll } from "vitest"; // Import Vitest functions
import { addIDBValue, deserialize, getIDBTransaction, getIDBValue, IDBLocation, OpfsLocation, putIDBValue, requestPromise, serialize } from "../../src/browser-utils/serialization";
import { DataType } from "../../src/utils/serialization";

describe("IndexedDB convenience functions", () => {
  const dbName = "ConvenienceFunctions";
  const storeName1 = "IDBBasicTest1";
  const keyPath1 = "key";
  const storeName2 = "IDBBasicTest2";
  const keyPath2 = "time.created";

  function storeFunctions(dbName: string, storeName: string, keyPath: string) {
    return {
      get: (key: string, valuePath?: string | string[]) =>
        getIDBValue(dbName, storeName, key, valuePath),
      put: (key: string, valuePath: string | string[] | undefined, value: any) =>
        putIDBValue(dbName, storeName, keyPath, key, valuePath, value),
      add: (key: string, valuePath: string | string[] | undefined, value: any) =>
        addIDBValue(dbName, storeName, keyPath, key, valuePath, value),
    };
  }

  const { get: get1, put: put1, add: add1 } = storeFunctions(dbName, storeName1, keyPath1);
  const { get: get2, put: put2, add: add2 } = storeFunctions(dbName, storeName2, keyPath2);

  beforeAll(async () => {
    await requestPromise(indexedDB.open(dbName, 1), (db) => {
      db.createObjectStore(storeName1, { keyPath: keyPath1 });
      db.createObjectStore(storeName2, { keyPath: keyPath2 });
    });
  })

  afterAll(async () => {
    await requestPromise(indexedDB.deleteDatabase(dbName));
  })

  it("get should return undefined when non-existing value is retrieved", async () => {
    await put1("food", "dinner", ["Broiled broccoli", "Shoyu and pepper rice"]);
    await put1("food", "lunch", "Potato salad");
    await put1("food", "breakfast", ["Omlette", "Peanut butter and jelly sandwich"]);
    expect(await get1("food", "dinner.1")).toBe("Shoyu and pepper rice");
    expect(await get1("food", "dinner.2")).toBeUndefined();
    expect(await get1("medicine", [])).toBeUndefined();
  })

  it("get and put should work with nested values", async () => {
    await put1("farewell", "phrases.0", "Goodbye.");
    await put1("farewell", "phrases.1", "See you later.");
    await put1("farewell", "phrases.2", "Take care.");
    expect(await get1("farewell", [])).toEqual({
      key: "farewell",
      phrases: {
        0: "Goodbye.",
        1: "See you later.",
        2: "Take care.",
      },
    })
    expect(await get1("farewell", ["phrases", "0"])).toBe("Goodbye.");
    expect(await get1("farewell", "phrases.1")).toBe("See you later.");

    await put1("dialog", "speeches", [
      { speaker: "John", text: "Hi there. Good to see you today." },
      { speaker: "Jane", text: "Hey. Good to see you too. How are you?" },
      { speaker: "John", text: "I'm great. Thanks for asking. How about you?" },
      { speaker: "Jane", text: "I'm doing well too." },
    ]);
    expect(await get1("dialog", "speeches.2.speaker")).toBe("John");
    expect(await get1("dialog", ["speeches", "3.text"])).toBe("I'm doing well too.");
  })

  it("put should replace and existing value with the same key", async () => {
    await put1("greeting", "first", "Hello.");
    await put1("greeting", "second", "How are you?");
    expect(await get1("greeting", [])).toEqual({
      key: "greeting",
      first: "Hello.",
      second: "How are you?",
    });

    await put1("greeting", "first", "Hi!");
    expect(await get1("greeting", undefined)).toEqual({
      key: "greeting",
      first: "Hi!",
      second: "How are you?",
    });
    expect(await get1("greeting", "key")).toBe("greeting");
    expect(await get1("greeting", "first")).toBe("Hi!");
    expect(await get1("greeting", "second")).toBe("How are you?");

  })

  it("get and put should work with nested keys", async () => {
    await put2("00:00:00", "time.finished", "00:01:00");
    await put2("00:00:00", "task", "Wash hands");
    await put2("00:01:00", "time.finished", "00:01:20");
    expect(await get2("00:00:00", [])).toEqual({
      time: {
        created: "00:00:00",
        finished: "00:01:00",
      },
      task: "Wash hands",
    })
    expect(await get2("00:00:00", "task")).toEqual("Wash hands");
    expect(await get2("00:01:00", "time.finished")).toEqual("00:01:20");
  })

  it("put should throw an error when value path is empty", async () => {
    const value = {
      time: {
        created: "00:02:00",
      }
    };
    await expect(put2("00:02:00", [], value)).rejects.toThrow();
  })

  it("add should not modify existing values", async () => {
    await add1("animals", "0", "dog");
    await add1("animals", "1", "cat");
    expect(await get1("animals")).toEqual({
      key: "animals",
      0: "dog",
      1: "cat",
    })
    await expect(add1("animals", "0", "deer")).rejects.toThrow();
  })

})

async function expectEqual(v1: any, v2: any) {
  if (typeof v1 === "object") {
    if (v1 instanceof Blob) {
      expect(await v1.arrayBuffer()).toEqual(await v2.arrayBuffer());
    } else {
      expect(v1).toEqual(v2);
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
  }

  beforeAll(async () => {
    await requestPromise(indexedDB.open(dbName, 1), (db) => {
      db.createObjectStore(storeName, { keyPath });
    });
  })

  afterAll(async () => {
    const transaction = await getIDBTransaction(dbName, storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    await requestPromise(store.clear());
  })

  it("should write data to IndexedDB", async () => {
    const pairs: [string, any][] = [
      ["string:greeting", "Hello, world!"],
      ["string:question", "How are you?"],
      ["string:empty", ""],
      ["boolean:false", false],
      ["boolean:true", true],
      ["number:0", 0],
      ["number:1", 1],
      ["number:-1", -1],
      ["number:NaN", NaN],
      ["number:-NaN", -NaN],
      ["number:Infinity", Infinity],
      ["number:-0", -0],
      ["number:-Infinity", -Infinity],
      ["object:null", null],
      ["object:array", [1, 2, 3]],
      ["object:nestedInArray", [1, [2, 3], { "d": 4, "e": [5, 6] }]],
      ["object:nestedObject", { "a": 1, "b": { "c": [3, 4, 5], "d": null } }],
      ["arraybuffer:empty", new ArrayBuffer(0)],
      ["arraybuffer:10bytes", (new Uint16Array([1, 2, 3, 4, 5])).buffer],
      ["blob:empty", new Blob([])],
      ["blob:10bytes", new Blob([(new Uint16Array([1, 2, 3, 4, 5])).buffer])],
    ];

    for (const [key, value] of pairs) {
      const location = { ...location0, key };
      const type = key.split(":", 1)[0];
      await serialize(value, location);
      await expectEqual(await deserialize(location, type as DataType), value);
    }
  })
})

describe("OPFS serialization", () => {
  const baseDir = "OPFSTest";
  const location0: OpfsLocation = {
    type: "opfs",
    path: [],
  }

  it("should write data to OPFS", async () => {
    const pairs: [string, any][] = [
      ["string:greeting", "Hello, world!"],
      ["string:question", "How are you?"],
      ["string:empty", ""],
      ["boolean:false", false],
      ["boolean:true", true],
      ["number:0", 0],
      ["number:1", 1],
      ["number:-1", -1],
      ["number:NaN", NaN],
      ["number:-NaN", -NaN],
      ["number:Infinity", Infinity],
      ["number:-0", -0],
      ["number:-Infinity", -Infinity],
      ["object:null", null],
      ["object:array", [1, 2, 3]],
      ["object:nestedInArray", [1, [2, 3], { "d": 4, "e": [5, 6] }]],
      ["object:nestedObject", { "a": 1, "b": { "c": [3, 4, 5], "d": null } }],
      ["arraybuffer:empty", new ArrayBuffer(0)],
      ["arraybuffer:10bytes", (new Uint16Array([1, 2, 3, 4, 5])).buffer],
      //      ["blob:empty", new Blob([])],
      ["blob:10bytes", new Blob([(new Uint16Array([1, 2, 3, 4, 5])).buffer])],
    ];

    for (const [key, value] of pairs) {
      const path = [baseDir, ...key.split(":")];
      const type = path[1];
      const location = { ...location0, path };
      await serialize(value, location);
      await expectEqual(await deserialize(location, type as DataType), value);
    }
  })
})

