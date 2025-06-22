export type DataType = "arraybuffer" | "blob" | "boolean" | "number" | "string" | "object" | "default";

export type ConversionOptions = {
  mimeType?: string;
  encoding?: string;
};

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
export function makeDataURL(
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

function parseAttributePath(path: string | undefined) {
  if (path == null) {
    return [];
  }
  return path.split(".");
}

export function getAttributeAtPath(value: Record<string, any>, path: string | undefined): any {
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

export function setAttributeAtPath(value: Record<string, any>, path: string | undefined, attrValue: any) {
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
  return value;
}

