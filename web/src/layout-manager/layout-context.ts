import { LayoutElement } from "./layout-element";
import { getAnchor, Interval, LayoutInterval, LayoutLength, LayoutRegion, normalizeInterval } from "./layout-region";

type IntervalKey = keyof Interval;

export class AbsoluteLength implements LayoutLength {
  type: "absolute" = "absolute";
  value: number;
  constructor(value: number) {
    this.value = value;
  }
  get actual() {
    return this.value;
  }

  serialize() {
    return {
      type: this.type,
      value: this.value,
    };
  }
  static deserialize(obj: { type: "absolute"; value: number }) {
    return new AbsoluteLength(obj.value);
  }
}

export class RelativeLength implements LayoutLength {
  type: "relative" = "relative";
  configuration: LayoutContext;
  baseId: number;
  dimension: number;
  key: IntervalKey;
  relativeRatio: number;
  constructor(
    configuration: LayoutContext,
    baseId: number,
    dimension: number,
    key: IntervalKey,
    relativeRatio: number,
  ) {
    this.configuration = configuration;
    this.baseId = baseId;
    this.dimension = dimension;
    this.key = key;
    this.relativeRatio = relativeRatio;
  }
  get actual() {
    return this.relativeRatio *
      (this.configuration
        .getLayoutRegionById(this.baseId)
        ?.axis[this.dimension]
        ?.actual
        ?.[this.key] ?? 0);
  }
}

export class AnchoredLength implements LayoutLength {
  type: "anchored" = "anchored";
  configuration: LayoutContext;
  baseId: number;
  dimension: number;
  anchorRatio: number;
  constructor(
    configuration: LayoutContext,
    baseId: number,
    dimension: number,
    anchorRatio: number,
  ) {
    this.configuration = configuration;
    this.baseId = baseId;
    this.dimension = dimension;
    this.anchorRatio = anchorRatio;
  }
  get actual() {
    return getAnchor(
      this.configuration
        .getLayoutRegionById(this.baseId)
        ?.axis[this.dimension]?.actual ??
      { start: 0, end: 0, length: 0 },
      this.anchorRatio,
    );
  }
}

export type ConfiguredLength =
  | AbsoluteLength
  | RelativeLength
  | AnchoredLength;

export class ConfiguredInterval implements LayoutInterval {
  start?: ConfiguredLength;
  length?: ConfiguredLength;
  end?: ConfiguredLength;

  constructor(params: {
    start?: ConfiguredLength;
    length?: ConfiguredLength;
    end?: ConfiguredLength;
  } = {}) {
    this.start = params.start;
    this.length = params.length;
    this.end = params.end;
  }

  get actual(): Interval {
    return normalizeInterval({
      start: this.start?.actual,
      length: this.length?.actual,
      end: this.end?.actual,
    })
  }
}

export class ConfiguredRegion extends LayoutRegion {
  axis: (ConfiguredInterval | undefined)[];
  constructor(axis: (ConfiguredInterval | undefined)[]) {
    super(axis);
    this.axis = axis;
  }
}

/**
 * Pairing of a {@link LayoutElement} and a {@link ConfiguredRegion}.
 *
 * A {@link ConfiguredRegion} stored in `region` is used to position `element`
 * inside a container by setting `element.region` appropriately.
 */
export class ConfiguredLayoutElement {
  element: LayoutElement;
  region: ConfiguredRegion;
  id?: number;
  resizeObserver?: ResizeObserver;
  constructor(element: LayoutElement, region: ConfiguredRegion) {
    this.element = element;
    this.region = region;
    this.element.region = region;
  }
}

/**
 * Class that manages {@link ConfiguredLayoutElement}s within a common
 * container.
 *
 * The `container` property must be set to an {@link HTMLElement} that is the
 * immediate `offsetParent` of all the {@link ConfiguredLayoutElement}s that
 * are managed by this class.
 */
export class LayoutContext {
  _container?: HTMLElement;

  constructor(container?: HTMLElement) {
    this._container = container;
  }

  private _elements: Map<number, ConfiguredLayoutElement> = new Map();
  private _elementToId: Map<ConfiguredLayoutElement, number> = new Map();
  private _elementIds: number[] = [];
  private _lastId: number = 0;

  addElement(element: ConfiguredLayoutElement) {
    const existingId = this._elementToId.get(element);
    if (existingId !== undefined) {
      return existingId;
    }
    this._elements.set(this._lastId, element);
    this._elementToId.set(element, this._lastId);
    this.connectChild(element);
    this._elementIds.push(this._lastId);
    element.id = this._lastId;
    return this._lastId++;
  }

  findElementId(element: ConfiguredLayoutElement) {
    return this._elementToId.get(element);
  }

  getElementById(elementId: number) {
    return this._elements.get(elementId);
  }

  getElements() {
    return this._elementIds.map(id => this._elements.get(id)!)
  }

  removeElementById(elementId: number) {
    const index = this._elementIds.findIndex(id => id === elementId);
    if (index < 0) {
      return undefined;
    }
    this._elementIds.splice(index);
    const element = this._elements.get(elementId)!;
    this.disconnectChild(element);
    this._elements.delete(elementId);
    this._elementToId.delete(element);
    return element;
  }

  removeElement(element: ConfiguredLayoutElement) {
    const id = this._elementToId.get(element);
    if (id === undefined) {
      return undefined;
    }
    return this.removeElementById(id);
  }

  getElementIndex(element: ConfiguredLayoutElement) {
    return this._elementIds.findIndex(id => id === element.id);
  }

  getElementIndexById(elementId: number) {
    return this._elementIds.findIndex(id => id === elementId);
  }

  getElementIdByIndex(index: number) {
    return this._elementIds[index];
  }

  getElementByIndex(index: number) {
    return this._elements.get(this._elementIds[index]);
  }

  moveElementToFirstIndexById(elementId: number) {
    const index = this._elementIds.findIndex(id => id === elementId);
    if (index < 0) {
      return undefined;
    }
    this._elementIds.splice(index);
    this._elementIds.unshift(elementId);
    return index;
  }

  moveElementToFirstIndex(element: ConfiguredLayoutElement) {
    const id = this._elementToId.get(element);
    if (id === undefined) {
      return undefined;
    }
    return this.moveElementToFirstIndexById(id);
  }

  moveElementToLastIndexById(elementId: number) {
    const index = this._elementIds.findIndex(id => id === elementId);
    if (index < 0) {
      return undefined;
    }
    this._elementIds.splice(index);
    this._elementIds.push(elementId);
    return index;
  }

  moveElementToLastIndex(element: ConfiguredLayoutElement) {
    const id = this._elementToId.get(element);
    if (id === undefined) {
      return undefined;
    }
    return this.moveElementToLastIndexById(id);
  }

  getLayoutRegionById(elementId: number) {
    if (!this._container) {
      return undefined;
    }
    if (elementId < 0) {
      return makeContainerLayoutRegion(this._container);
    }
    const element = this._elements.get(elementId);
    if (!element) {
      throw new Error(`element id ${elementId} not found`);
    }
    return element.region;
  }

  useConfiguredRegionById(elementId: number) {
    if (!this._container || elementId < 0) {
      return;
    }
    const element = this._elements.get(elementId);
    if (!element) {
      throw new Error(`element id ${elementId} not found`);
    }
    element.element.region = element.region;
  }

  useConfiguredRegion(element: ConfiguredLayoutElement) {
    const id = this._elementToId.get(element);
    if (id === undefined) {
      throw new Error("element not found");
    }
    this.useConfiguredRegionById(id);
  }

  useConfiguredRegions() {
    for (const [element] of this._elementToId) {
      element.element.region = element.region;
    }
  }

  makeElementRootRelativeById(elementId: number) {
    const element = this._elements.get(elementId);
    if (!element) {
      return undefined;
    }
    this.makeElementRootRelative(element);
    return element;
  }

  makeElementRootRelative(element: ConfiguredLayoutElement) {
    if (element.element.offsetParent !== this._container ||
      !this._elementToId.has(element)
    ) {
      return undefined;
    }
    element.region = this.getElementRootRelativeRegion(element.element);
    return element.region;
  }

  createRootRelativeElement(element: LayoutElement) {
    return new ConfiguredLayoutElement(
      element,
      this.getElementRootRelativeRegion(element),
    );
  }

  getElementRootRelativeRegion(element: HTMLElement) {
    if (element.offsetParent !== this._container) {
      throw new Error("element does not belong to the container");
    }
    const {
      offsetLeft: left,
      offsetWidth: width,
      offsetTop: top,
      offsetHeight: height,
    } = element;
    return this.getRootRelativeRegion({
      left, width, top, height,
    })
  }

  getRootRelativeRegion(rect: {
    left: number;
    width: number;
    top: number;
    height: number;
  }): ConfiguredRegion {
    const { left, width, top, height } = rect;
    if (!this._container) {
      // Fallback is absolute.
      return new ConfiguredRegion([
        new ConfiguredInterval({
          start: new AbsoluteLength(left),
          length: new AbsoluteLength(width),
        }),
        new ConfiguredInterval({
          start: new AbsoluteLength(top),
          length: new AbsoluteLength(height),
        }),
      ]);
    }
    const { offsetWidth: containerWidth, offsetHeight: containerHeight } =
      this._container;
    return new ConfiguredRegion([
      new ConfiguredInterval({
        start: new RelativeLength(this, -1, 0,
          "length", left / containerWidth,
        ),
        length: new RelativeLength(this, -1, 0,
          "length", width / containerWidth,
        ),
      }),
      new ConfiguredInterval({
        start: new RelativeLength(this, -1, 1,
          "length", top / containerHeight,
        ),
        length: new RelativeLength(this, -1, 1,
          "length", height / containerHeight,
        ),
      }),
    ]);
  }

  private connectChild(child: ConfiguredLayoutElement) {
    this.disconnectChild(child);
    child.resizeObserver = new ResizeObserver(() => {
      child.element.requestUpdate();
    });
    if (this._container) {
      child.resizeObserver.observe(this._container);
    }
  }

  private disconnectChild(child: ConfiguredLayoutElement) {
    if (child.resizeObserver) {
      child.resizeObserver.disconnect();
      child.resizeObserver = undefined;
    }
  }

  get container(): HTMLElement | undefined {
    return this._container;
  }

  set container(container: HTMLElement) {
    if (container === this._container) {
      return;
    }
    for (const [element] of this._elementToId) {
      this.connectChild(element);
      this.useConfiguredRegions();
    }
  }

}

function makeContainerLayoutRegion(element: HTMLElement) {
  return new LayoutRegion([
    {
      get actual() {
        const { offsetWidth: width } = element;
        return {
          start: 0,
          end: width,
          length: width,
        }
      }
    },
    {
      get actual() {
        const { offsetHeight: height } = element;
        return {
          start: 0,
          end: height,
          length: height,
        }
      }
    },
  ])
}

