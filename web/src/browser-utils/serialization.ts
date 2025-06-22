import { ConversionOptions, convert, DataType, getAttributeAtPath, makeDataURL, makeObjectURL, setAttributeAtPath, } from "../utils/serialization";

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
      return await new Promise((res, rej) => {
        try {
          const openRequest = indexedDB.open(dbName);
          openRequest.onerror = () => {
            rej(`Failed to open IDB "${dbName}"`);
          };
          openRequest.onsuccess = () => {
            try {
              const db = openRequest.result;
              const transaction = db.transaction([storeName], "readonly");
              const store = transaction.objectStore(storeName);
              const getRequest: IDBRequest = store.get(key);
              getRequest.onsuccess = () => {
                let { result } = getRequest;
                try {
                  res(convert(getAttributeAtPath(result, valuePath), targetType, options));
                } catch (e) {
                  rej(e);
                }
              }
              getRequest.onerror = () => {
                rej(`Failed to access IDB store`);
              }
            } catch (e) {
              rej(e);
            }
          }
        }
        catch (e) {
          rej(e);
        }
      });
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
      return await new Promise((res, rej) => {
        try {
          const openRequest = version == null ? indexedDB.open(dbName) : indexedDB.open(dbName, version);
          openRequest.onerror = () => {
            rej(`Failed to open IDB "${dbName}"`);
          }
          openRequest.onsuccess = () => {
            try {
              const db = openRequest.result;
              const transaction = db.transaction([storeName], "readwrite");
              const store = transaction.objectStore(storeName);

              const getRequest = store.get(key);
              getRequest.onsuccess = () => {
                let { result } = getRequest
                if (result == null) {
                  result = {};
                  setAttributeAtPath(result, keyPath, key);
                }
                setAttributeAtPath(result, valuePath, value);
                const putRequest = store.put(result);
                putRequest.onsuccess = () => {
                  res(location);
                }
                putRequest.onerror = () => {
                  rej("failed to write to IDB store");
                }
              }
              getRequest.onerror = () => {
                rej("failed to access IDB store");
              }
            } catch (e) {
              rej(e);
            }
          };
          openRequest.onupgradeneeded = () => {
            const db = openRequest.result;
            const transaction = openRequest.transaction!;
            let store: IDBObjectStore;
            if (!db.objectStoreNames.contains(storeName)) {
              store = db.createObjectStore(storeName, { keyPath });
            } else {
              store = transaction.objectStore(storeName);
              if (store.keyPath !== keyPath) {
                db.deleteObjectStore(storeName);
                store = db.createObjectStore(storeName, { keyPath });
              }
            }
          }
        } catch (e) {
          rej(e);
        }
      });
    }
  }
}

/**
 * Convenience Promise wrapper for {@link IDBRequest}.
 */
export function requestPromise(request: IDBRequest, onupgradeneeded?: (db: IDBDatabase) => any) {
  return new Promise((res, rej) => {
    request.onerror = () => {
      rej();
    }
    request.onsuccess = () => {
      res(request.result);
    }
    if (onupgradeneeded) {
      (request as IDBOpenDBRequest).onupgradeneeded = () => {
        try {
          onupgradeneeded(request.result as IDBDatabase);
          res(request.result as IDBDatabase);
        } catch (e) {
          rej(e);
        }
      };
    }
  });
}

export async function getIDBTransaction(
  dbName: string,
  storeName: string,
  mode: "readonly" | "readwrite",
) {
  const db = await requestPromise(indexedDB.open(dbName)) as IDBDatabase;
  return db.transaction([storeName], mode);
}

export async function getIDBValue(
  dbName: string,
  storeName: string,
  key: string,
  valuePath?: string,
): Promise<any> {
  const transaction = await getIDBTransaction(dbName, storeName, "readonly")
  const value = await requestPromise(transaction.objectStore(storeName).get(key));
  if (value != null) {
    return getAttributeAtPath(value, valuePath);
  }
  return undefined;
}

export async function putIDBValue(
  dbName: string,
  storeName: string,
  keyPath: string | undefined,
  key: string,
  valuePath: string | undefined,
  value: any,
) {
  const transaction = await getIDBTransaction(dbName, storeName, "readwrite")
  const store = transaction.objectStore(storeName);
  let currentValue = await requestPromise(store.get(key)) as any;
  if (currentValue == null) {
    currentValue = setAttributeAtPath({}, keyPath, key);
  }
  setAttributeAtPath(currentValue as Object, valuePath, value);
  await requestPromise(store.put(currentValue));
}

export async function addIDBValue(
  dbName: string,
  storeName: string,
  keyPath: string | undefined,
  key: string,
  valuePath: string | undefined,
  value: any,
) {
  const transaction = await getIDBTransaction(dbName, storeName, "readwrite")
  const store = transaction.objectStore(storeName);
  let currentValue = await requestPromise(store.get(key)) as any;
  if (currentValue == null) {
    currentValue = setAttributeAtPath({}, keyPath, key);
  } else if (getAttributeAtPath(currentValue, valuePath) !== undefined) {
    throw new DOMException("value already exists", "DataError");
  }
  setAttributeAtPath(currentValue as Object, valuePath, value);
  await requestPromise(store.put(currentValue));
}

