export interface LayoutLength {
  get actual(): number;
}

export function makeLayoutLength(calc: () => number): LayoutLength {
  return {
    get actual() {
      return calc();
    }
  }
}

export class AbsoluteLayoutLength implements LayoutLength {
  value: number;
  constructor(value: number) {
    this.value = value;
  }
  get actual() {
    return this.value;
  }
}

export class RelativeLayoutLength implements LayoutLength {
  ratio: number;
  base: LayoutLength | LayoutInterval;
  constructor(ratio: number, base: LayoutLength | LayoutInterval) {
    this.ratio = ratio;
    this.base = base;
  }
  get actual() {
    const baseLength = this.base.actual;
    if (typeof baseLength === "object" &&
      typeof baseLength?.length === "number") {
      return this.ratio * baseLength.length;
    }
    if (typeof baseLength === "number") {
      return this.ratio * baseLength;
    }
    throw "base of RelativeLayoutLength has invalid type";
  }
}

export class DynamicLayoutLength implements LayoutLength {
  calc: () => number;
  constructor(calc: () => number) {
    this.calc = calc;
  }
  get actual() {
    return this.calc();
  }
}

export type Interval = {
  start: number;
  end: number;
  length: number;
}

export function normalizeInterval(interval: Partial<Interval>): Interval {
  let { start, end, length } = interval;
  if (length === undefined) {
    if (start === undefined) {
      if (end === undefined) {
        end = 0;
      }
      start = end;
    } else if (end === undefined) {
      end = start;
    }
    length = end - start;
  } else {
    if (end === undefined) {
      if (start === undefined) {
        start = 0;
      }
      end = start + length;
    } else if (start === undefined) {
      start = end - length;
    } else {
      end = start + length;
    }
  }
  return {
    start: start!,
    end: end!,
    length: length!,
  };
}

export interface LayoutInterval {
  get actual(): Interval;
}

export function makeLayoutInterval(
  calc: () => Partial<Interval>,
): LayoutInterval {
  return {
    get actual() {
      return normalizeInterval(calc());
    }
  }
}

export function getAnchor(interval: Interval, anchorRatio: number) {
  const { start, end, length } = interval;
  return 0.5 * start + 0.5 * end + anchorRatio * length;
}

export function getLayoutAnchor(interval: LayoutInterval, anchorRatio: number) {
  return new DynamicLayoutLength(
    () => getAnchor(interval.actual, anchorRatio)
  );
}

export class AbsoluteLayoutInterval implements LayoutInterval {
  interval: Interval;
  constructor(interval: Partial<Interval> = {}) {
    this.interval = normalizeInterval(interval);
  }
  get actual() {
    return this.interval;
  }
}

export type DynamicInterval = {
  start: LayoutLength;
  end: LayoutLength;
  length: LayoutLength;
}

export class DynamicLayoutInterval implements LayoutInterval {
  interval: Partial<DynamicInterval>;
  constructor(interval: Partial<DynamicInterval> = {}) {
    this.interval = interval;
  }
  get actual(): Interval {
    const start = this.interval.start?.actual;
    const end = this.interval.end?.actual;
    const length = this.interval.length?.actual;
    return normalizeInterval({ start, end, length });
  }
}

export type Volume = number[];

export class LayoutVolume {
  axis: (LayoutLength | undefined)[];
  constructor(axis: (LayoutLength | undefined)[]) {
    this.axis = axis;
  }
  get actual(): Volume {
    return this.axis.map(
      layoutLength => layoutLength?.actual ?? 0
    );
  }
  get dim() {
    return this.axis.length;
  }
}

export type Region = Interval[];

export class LayoutRegion {
  axis: (LayoutInterval | undefined)[];
  constructor(axis: (LayoutInterval | undefined)[]) {
    this.axis = axis;
  }
  get actual(): Region {
    return this.axis.map(
      interval => interval?.actual ?? { start: 0, end: 0, length: 0 }
    );
  }
  get dim(): number {
    return this.axis.length;
  }
}

