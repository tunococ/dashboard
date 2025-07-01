export interface Cacheable {
  clearCache(): void;
}

export interface LayoutLength {
  get actualLength(): number;
}

export class CachedLayoutLength implements LayoutLength, Cacheable {
  private _cache?: number;
  private _resolve: () => number;
  constructor(resolve: () => number) {
    this._resolve = resolve;
  }
  get actualLength() {
    if (this._cache !== undefined) {
      return this._cache;
    }
    this._cache = this._resolve();
    return this._cache;
  }
  clearCache() {
    this._cache = undefined;
  }
}

export class AbsoluteLayoutLength extends CachedLayoutLength {
  value: number;
  constructor(value: number) {
    super(() => this.value);
    this.value = value;
  }
}

export class RelativeLayoutLength extends CachedLayoutLength {
  base: LayoutLength | (LayoutLength & Cacheable);
  constructor(ratio: number, base: LayoutLength & Cacheable);
  constructor(ratio: number, base: LayoutLength);
  constructor(ratio: number, base: LayoutLength) {
    super(() => this.base.actualLength * ratio);
    this.base = base;
  }
  clearCache() {
    super.clearCache();
    if (typeof (this.base as any).clearCache === "function") {
      (this.base as any).clearCache();
    }
  }
}

interface LayoutInterval extends LayoutLength {
  get actualStart(): number;
  get actualEnd(): number;
}

class CachedLayoutInterval implements LayoutInterval {
  private _cache?: { start: number; end: number; length: number };
  private _resolve: () => { start?: number; end?: number; length?: number };
  constructor(
    resolve: () => { start?: number; end?: number; length?: number },
  ) {
    this._resolve = resolve;
  }
  resolve() {
    const { start, end, length } = this._resolve();
    if (length === undefined) {
      if (start === undefined) {
        if (end === undefined) {
          return {
            start: 0,
            end: 0,
            length: 0,
          };
        }
        return {
          start: end,
          end,
          length: 0,
        };
      }
      if (end === undefined) {
        return {
          start,
          end: start,
          length: 0,
        };
      }
      return {
        start,
        end,
        length: end - start,
      };
    }
    if (start === undefined) {
      if (end === undefined) {
        return {
          start: 0,
          end: length,
          length,
        };
      }
      return {
        start: end - length,
        end,
        length,
      };
    }
    return {
      start,
      end: start + length,
      length,
    };
  }
  get actualInterval() {
    if (!this._cache) {
      this._cache = this.resolve();
    }
    return this._cache;
  }
  get actualLength() {
    return this.actualInterval.length;
  }
  get actualStart() {
    return this.actualInterval.start;
  }
  get actualEnd() {
    return this.actualInterval.end;
  }
  clearCache() {
    this._cache = undefined;
  }
}

export class AbsoluteInterval extends CachedLayoutInterval {
  value: { start?: number; end?: number; length?: number };
  constructor(value: { start?: number; end?: number; length?: number }) {
    super(() => this.value);
    this.value = value;
  }
}
