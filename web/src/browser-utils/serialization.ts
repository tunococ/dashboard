import { ConversionOptions, convert, DataType, getAttributeAtPath, makeDataURL, makeObjectURL, setAttributeAtPath, } from "../utils/serialization";
import { SyncChain } from "../utils/sync-chain";
import { idbDatabase, idbTransaction, requestChain } from "./idb";

export type OpfsLocation = {
  type: "opfs";
  path: string[];
};

export type BlobLocation = {
  type: "blob";
  blob: Blob;
};

export type FileLocation = {
  type: "file";
  fileHandle: FileSystemFileHandle;
};

export type IDBLocation = {
  type: "idb";
  dbName: string;
  storeName: string;
  version?: number;
  key: string;
  keyPath: string;
  valuePath: string;
};

export type LocalStorageLocation = {
  type: "local";
  key: string;
  valuePath?: string;
}

export type WriteLocation = OpfsLocation | IDBLocation | LocalStorageLocation | FileLocation;
export type ReadLocation = OpfsLocation | IDBLocation | LocalStorageLocation | BlobLocation;

export type Data = ArrayBuffer | string | Record<string, any>;

export async function deserialize(
  location: ReadLocation,
  targetType: "blob",
  options?: ConversionOptions): Promise<Blob>;
export async function deserialize(
  location: ReadLocation,
  targetType: "string" | "dataurl" | "objecturl",
  options?: ConversionOptions): Promise<string>;
export async function deserialize(
  location: ReadLocation,
  targetType: "arraybuffer",
  options?: ConversionOptions): Promise<ArrayBuffer>;
export async function deserialize(
  location: ReadLocation,
  targetType: "boolean",
  options?: ConversionOptions): Promise<boolean>;
export async function deserialize(
  location: ReadLocation,
  targetType: "number",
  options?: ConversionOptions): Promise<number>;
export async function deserialize(
  location: ReadLocation,
  targetType: "object" | "default",
  options?: ConversionOptions): Promise<any>;
export async function deserialize(
  location: ReadLocation,
  targetType: DataType,
  options?: ConversionOptions,
): Promise<any>;
/**
 * Reads data from a given location in a specified format.
 *
 * @param location Where the data source is.
 * @param targetType Output format. If this is `"objecturl"`, the caller should
 *   call {@link revokeObjectURL} to release the object URL when it is no
 *   longer needed.
 * @param mimeType MIME type of the output. This only applies when the output
 *   contains a MIME type, i.e., when `dataType === "dataurl"` or
 *   `dataType === "objecturl"`. If `mimeType` is not specified, the output
 *   will derive its MIME type from the input or from the browser's detection.
 * @param encoding Input encoding. This only applies if the data source is a
 *   is an encoded text, i.e., an {@link ArrayBuffer} or a {@link Blob}.
 *   If not specified, the default value `"UTF-8"` will be used.
 */
export async function deserialize(
  location: ReadLocation,
  targetType: DataType | "dataurl" | "objecturl" = "default",
  options: ConversionOptions = {},
) {
  const { mimeType } = options;

  // For "dataurl" and "objecturl", we convert to "blob" first, then call the
  // corresponding function to generate the URL.
  if (targetType === "dataurl" || targetType === "objecturl") {
    const blob = await deserialize(location, "blob", options);
    if (targetType === "dataurl") {
      return await makeDataURL(blob, mimeType)
    }
    return makeObjectURL(blob, mimeType);
  }

  switch (location.type) {
    case "blob": {
      let { blob } = location;
      if (targetType === "blob") {
        return convert(blob, "blob", options);
      }
      return await new Promise((res, rej) => {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            let { result } = reader;
            if (!result) {
              rej("Unexpected reading error");
            } else {
              res(convert(result, targetType, options));
            }
          };
          reader.onerror = () => {
            rej("Failed to read from blob");
          }
          reader.onabort = () => {
            rej("Reading aborted");
          }
          reader.readAsArrayBuffer(blob);
        } catch (e) {
          rej(e);
        }
      });
    }
    case "opfs": {
      const path = [...location.path];
      try {
        const root = await navigator.storage.getDirectory();
        if (!root) {
          throw "OPFS inaccessible";
        }
        if (path.length < 1) {
          throw "OPFS path must not be empty";
        }
        let currentDir = root;
        let i = 0;
        for (; i < path.length - i; ++i) {
          currentDir = await currentDir.getDirectoryHandle(path[i]);
        }
        const file = await currentDir.getFileHandle(path[i]);

        return await deserialize({
          type: "blob",
          blob: new Blob([await file.getFile()]),
        }, targetType, options);
      } catch (e) {
        throw e;
      }
    }
    case "idb": {
      const { dbName, key, valuePath, storeName } = location;
      if (key == null) {
        throw "key must be defined";
      }
      if (valuePath == null) {
        throw "valuePath must be defined";
      }
      return convert(await getIDBValue(dbName, storeName, key, valuePath), targetType, options);
    }
    case "local": {
      break;
    }
  }
}

export async function serialize(value: any, location: WriteLocation, options: ConversionOptions = {}) {
  const { mimeType } = options;
  switch (location.type) {
    case "file": {
      const { fileHandle } = location;
      if (!(value instanceof Blob)) {
        value = convert(value, "blob", options);
      }
      const writable = await fileHandle.createWritable();
      await writable.write(value);
      await writable.close();

      let file = await fileHandle.getFile();
      if (mimeType) {
        file = new File([file], file.name, { type: mimeType });
      }
      return file;
    }
    case "opfs": {
      const path = [...location.path];
      const root = await navigator.storage.getDirectory();
      if (!root) {
        throw "OPFS inaccessible";
      }
      if (path.length < 1) {
        throw "OPFS path must not be empty";
      }
      let currentDir = root;
      let i = 0;
      for (; i < path.length - i; ++i) {
        currentDir = await currentDir.getDirectoryHandle(path[i], { create: true });
      }
      const fileHandle = await currentDir.getFileHandle(path[i], { create: true });
      return await serialize(
        value,
        {
          type: "file",
          fileHandle,
        },
        options,
      );
    }
    case "idb": {
      const { dbName, storeName, key, keyPath, valuePath, version } = location;
      if (key == null) {
        throw "key must not be null";
      }
      if (keyPath == null) {
        throw "keyPath must not be null";
      }
      if (valuePath == null) {
        throw "valuePath must not be null";
      }
      return await putIDBValue(dbName, storeName, key, valuePath, value, keyPath, version);
    }
  }
}

export function initIDBStores(
  dbName: string,
  stores: { name: string; keyPath: string; }[],
  version?: number,
) {
  const populateStores = (db: IDBDatabase) => {
    for (const { name, keyPath } of stores) {
      if (db.objectStoreNames.contains(name)) {
        db.deleteObjectStore(name);
      }
      db.createObjectStore(name, { keyPath });
    }
  };

  if (version === undefined) {
    let currentVersion = 0;
    return idbDatabase(dbName, version, populateStores).then(db => {
      try {
        currentVersion = db.version;
        const transaction = db.transaction(
          stores.map(({ name }) => name),
          "readonly",
        );
        for (const { name, keyPath } of stores) {
          const store = transaction.objectStore(name);
          if (store.keyPath !== keyPath) {
            throw 1;
          }
        }
        return SyncChain.resolve(db);
      } catch (error) {
        db.close();
        return idbDatabase(dbName, currentVersion + 1, populateStores);
      }
    }).then(db => db.close()).promise;
  }
  return idbDatabase(dbName, version, populateStores)
    .then(db => db.close());
}

export function clearIDBStore(
  dbName: string,
  storeNames: string[],
) {
  return idbDatabase(dbName).then(db => {
    try {
      const [transaction, committed] = idbTransaction(db, storeNames, "readwrite");
      const clear = SyncChain.all(storeNames.map(storeName => {
        return requestChain(transaction.objectStore(storeName).clear());
      }));
      return SyncChain.all([clear, committed]).finally(() => db.close());
    } catch (error) {
      db.close();
      throw error;
    }
  }).promise;
}

export function getIDBValue(
  dbName: string,
  storeName: string,
  key: string,
  valuePath?: string,
) {
  return idbDatabase(dbName).then(db => {
    try {
      const [transaction] = idbTransaction(db, [storeName]);
      const store = transaction.objectStore(storeName);
      return requestChain(store.get(key))
        .then(value => {
          if (value != null) {
            return getAttributeAtPath(value, valuePath)
          } else {
            return undefined;
          }
        })
        .finally(() => {
          db.close();
        })
    } catch (error) {
      db.close();
      throw error;
    }
  }).promise;
}

export function setIDBValue(
  dbName: string,
  storeName: string,
  key: string,
  valuePath: string | undefined,
  value: any,
  overwrite: boolean = true,
  keyPath?: string,
  version?: number,
) {
  return idbDatabase(dbName, version, db => {
    if (keyPath === undefined) {
      throw new Error(`keyPath is missing when upgrading IDB "${dbName}.${storeName}" to version ${version}`);
    }
    if (db.objectStoreNames.contains(storeName)) {
      db.deleteObjectStore(storeName);
    }
    db.createObjectStore(storeName, {
      keyPath
    })
  }).then(db => {
    try {
      const [transaction, committed] = idbTransaction(db, [storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      return requestChain(store.get(key)).then(currentValue => {
        if (currentValue == null) {
          const keyPath = store.keyPath;
          if (typeof keyPath !== "string") {
            throw new Error("putIDBValue -- keyPath is not string")
          }
          currentValue = setAttributeAtPath({}, keyPath, key);
        } else if (!overwrite && getAttributeAtPath(currentValue, valuePath) !== undefined) {
          throw new DOMException("value already exists", "DataError");
        }
        currentValue = setAttributeAtPath(currentValue as Object, valuePath, value);
        return SyncChain.all([requestChain(store.put(currentValue)), committed]);
      }).finally(() => db.close());
    } catch (error) {
      db.close();
      throw error;
    }
  }).then(() => { }).promise;
}

export function putIDBValue(
  dbName: string,
  storeName: string,
  key: string,
  valuePath: string | undefined,
  value: any,
  keyPath?: string,
  version?: number,
) {
  return setIDBValue(dbName, storeName, key, valuePath, value, true, keyPath, version);
}

export function addIDBValue(
  dbName: string,
  storeName: string,
  key: string,
  valuePath: string | undefined,
  value: any,
  keyPath?: string,
  version?: number,
) {
  return setIDBValue(dbName, storeName, key, valuePath, value, false, keyPath, version);
}

