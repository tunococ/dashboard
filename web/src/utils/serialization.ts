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
  key?: string;
  keyPath: string;
  value?: string;
  valuePath?: string;
};

export type LocalStorageLocation = {
  type: "local";
  key: string;
  valuePath?: string;
}

export type WriteLocation = OpfsLocation | IDBLocation | LocalStorageLocation | FileLocation;
export type ReadLocation = OpfsLocation | IDBLocation | LocalStorageLocation | BlobLocation;

export type Data = ArrayBuffer | string | Record<string, any>;

export type DataType = "arraybuffer" | "blob" | "boolean" | "number" | "string" | "object" | "default";

export type ConversionOptions = {
  mimeType?: string;
  encoding?: string;
};

export async function deserialize(
  location: ReadLocation,
  targetType: "blob",
  options: ConversionOptions): Promise<Blob>;
export async function deserialize(
  location: ReadLocation,
  targetType: "string" | "dataurl" | "objecturl",
  options: ConversionOptions): Promise<string>;
export async function deserialize(
  location: ReadLocation,
  targetType: "arraybuffer",
  options: ConversionOptions): Promise<ArrayBuffer>;
export async function deserialize(
  location: ReadLocation,
  targetType: "boolean",
  options: ConversionOptions): Promise<boolean>;
export async function deserialize(
  location: ReadLocation,
  targetType: "number",
  options: ConversionOptions): Promise<number>;
export async function deserialize(
  location: ReadLocation,
  targetType: "object" | "default",
  options: ConversionOptions): Promise<any>;
export async function deserialize(
  location: ReadLocation,
  targetType: DataType,
  options: ConversionOptions,
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
          blob: await file.getFile(),
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
              const getRequest = store.get(key);
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
      } catch (e) {
        throw e;
      }
    }
    case "idb": {
      const { dbName, storeName, key, keyPath, value, valuePath, version } = location;
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
                let { result } = getRequest.result
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
 * Converts data between serializable basic types and {@link ArrayBuffer}.
 *
 * `value` cannot be a {@link Blob}, but `targetType` can be `"blob"`.
 *
 * @param value Input
 * @param dataType Target type
 * @param encoding Text encoding of the input. This only applies if the
 *   input is an {@link ArrayBuffer} and the output type is `string`.
 *   (Note that conversion from `string` to {@link ArrayBuffer} will only use
 *   UTF-8 encoding.)
 * @param mimeType Mime type of the output {@link Blob}. This only applies if
 *   `dataType === "blob"`.
 */
export function convert(
  value: any,
  targetType: DataType,
  options: ConversionOptions = {},
) {
  const { encoding, mimeType } = options;
  switch (targetType) {
    case "arraybuffer": {
      if (value instanceof ArrayBuffer) {
        return value;
      }
      if (typeof value === "object") {
        value = JSON.stringify(value);
      }
      if (typeof value === "string") {
        const encoder = new TextEncoder();
        return encoder.encode(value).buffer;
      }
      if (typeof value === "number") {
        const array = new Float64Array([value]);
        return array.buffer;
      }
      if (typeof value === "boolean") {
        const array = new Uint8Array([value ? 1 : 0]);
        return array.buffer;
      }
      throw `Cannot convert ${typeof value} to ArrayBuffer`;
    }
    case "boolean": {
      if (value instanceof ArrayBuffer) {
        const array = new Uint8Array(value);
        return !!array.length && !!array[0];
      }
      if (typeof value === "string") {
        return value === "true";
      }
      return !!value;
    }
    case "number": {
      if (typeof value === "number") {
        return value;
      }
      if (value instanceof ArrayBuffer) {
        const array = new Float64Array(value);
        return array[0];
      }
      if (typeof value === "string") {
        return Number.parseFloat(value);
      }
      if (typeof value === "boolean") {
        return value ? 1 : 0;
      }
      throw `Cannot convert ${typeof value} to number`;
    }
    case "string": {
      if (typeof value === "number") {
        if (Object.is(value, -0)) {
          return "-0";
        }
        return value.toString();
      }
      if (value instanceof ArrayBuffer) {
        const decoder = new TextDecoder(encoding);
        return decoder.decode(value);
      }
      if (typeof value === "object") {
        return JSON.stringify(value);
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "boolean") {
        return value ? "true" : "false";
      }
      throw `Cannot convert ${typeof value} to string`;
    }
    case "object": {
      if (value instanceof ArrayBuffer) {
        value = convert(value, "string", options);
      }
      if (typeof value === "object") {
        return value;
      }
      if (typeof value === "string") {
        return JSON.parse(value);
      }
      throw `Cannot convert ${typeof value} to object`;
    }
    case "blob": {
      if (value instanceof Blob) {
        if (mimeType) {
          value = new Blob([value], { type: mimeType });
        }
        return value;
      }
      if (!(value instanceof ArrayBuffer)) {
        try {
          value = convert(value, "arraybuffer", options);
        } catch (e) {
          throw `Cannot convert ${typeof value} to Blob`;
        }
      }
      return new Blob([value], { type: mimeType });
    }
  }
}

/**
 * Creates an object URL for the given `value`.
 *
 * The return value is a string that can be used in other HTML elements such as
 * `<iframe>`, `<img>`, `<audio>`, `<video>`.
 *
 * The returned URL must be released by calling {@link revokeObjectURL} once it
 * is no longer needed; otherwise it will leak memory.
 */
export function makeObjectURL(value: any, mimeType?: string) {
  return URL.createObjectURL(convert(value, "blob", { mimeType }));
}

/**
 * Creates an object URL for the given `value`.
 *
 * The return value is a string that can be used in other HTML elements such as
 * `<iframe>`, `<img>`, `<audio>`, `<video>`.
 */
export async function makeDataURL(
  value: any,
  mimeType?: string,
): Promise<string> {
  const blob = convert(value, "blob", { mimeType });
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      res(reader.result as string);
    }
    reader.onerror = () => {
      rej("Failed to convert to data URL");
    }
    reader.onabort = () => {
      rej("Conversion to data URL aborted");
    }
    reader.readAsDataURL(blob);
  });
}

export async function fetchBlob(url: string) {
  const response = await fetch(url);
  return await response.blob();
}

function parseAttributePath(path: string | string[]) {
  if (typeof path === "string") {
    return parseAttributePath([path]);
  }
  return path.flatMap((p) => p.split("."));
}

function getAttributeAtPath(value: Record<string, any>, path: string | string[]) {
  const attrNames = parseAttributePath(path);
  if (attrNames.length === 0) {
    return value;
  }
  let currentValue = value;
  for (const attrName of attrNames) {
    if (currentValue == undefined) {
      break;
    }
    currentValue = currentValue[attrName];
  }
  return currentValue;
}

function setAttributeAtPath(value: Record<string, any>, path: string | string[], attrValue: any) {
  const attrNames = parseAttributePath(path);
  if (attrNames.length === 0) {
    throw "attribute path must not be empty";
  }
  if (!value) {
    throw "value must not be empty";
  }
  let currentValue = value;
  let i = 0;
  for (; i < attrNames.length - 1; ++i) {
    const attrName = attrNames[i];
    if (!(attrName in currentValue)) {
      currentValue[attrName] = {};
    }
    currentValue = currentValue[attrName];
  }
  currentValue[attrNames[i]] = attrValue;
}

