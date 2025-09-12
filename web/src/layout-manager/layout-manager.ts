import { css, html, LitElement, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { html as shtml } from "lit/static-html.js";
import { ConfiguredRegion } from "./layout-context";
import { LayoutControlEvent, LayoutElement } from "./layout-element";
import { Point2D } from "../utils/geometry-2d";

export type ManagedElementId = bigint;

export class LayoutManager extends LitElement {

  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link LayoutManager} as a custom web component with tag
   * `tagName`.
   *
   * The return value of this function is the tag name that was registered with
   * this component.
   *
   * Since a component can be registered only once, only the first call will
   * actually register the component. Subsequent calls will simply return the
   * tag name that was first registered.
   *
   * Other components that depend on this module can call this function to
   * retrieve the correct tag name instead of assuming that the tag name they
   * supply to `register` is the correct one.
   *
   * @param tagName Desired tag name.
   * @returns The tag name that was registered for this element.
   *   This may be different from the input `tagName` if `register` had been
   *   called earlier, in which case, this return value should be used.
   */
  static register(tagName: string = "layout-manager"): string {
    if (!LayoutManager.tagName) {
      customElements.define(tagName, LayoutManager);
      LayoutManager.tagName = tagName;
    }
    return LayoutManager.tagName;
  }

  static get styles() {
    return css`
      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      :host {
        --srem: 1rem;
        position: relative;
        display: inline-block;
      }

      #container {
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    `;
  }

  private initializeContainer = (e: any) => {
    this.container = e;
    if (this.container) {
      setTimeout(() => this.requestUpdate(), 0);
    }
  }

  render() {
    const onPointerEvent = (event: PointerEvent) => {
      this.onPointerEvent(event);
    }
    const onGotPointerCapture = (event: PointerEvent) => {
      this.onGotPointerCapture(event);
    }
    const onLostPointerCapture = (event: PointerEvent) => {
      this.onLostPointerCapture(event);
    }

    const configuredLayoutElements = this.context?.getElements();
    const elements = configuredLayoutElements?.map(e => {
      return e.element;
    }) ?? nothing;
    return html`
      <div id="container"
        @pointermove=${onPointerEvent}
        @pointerover=${onPointerEvent}
        @pointerenter=${onPointerEvent}
        @pointerleave=${onPointerEvent}
        @pointerout=${onPointerEvent}
        @pointercancel=${onPointerEvent}
        @pointerdown=${onPointerEvent}
        @pointerup=${onPointerEvent}
        @gotpointercapture=${onGotPointerCapture}
        @lostpointercapture=${onLostPointerCapture}
        ${ref(this.initializeContainer)}
      >
        <slot></slot>
        ${elements}
      </div>
    `;
  }

  constructor() {
    super();
  }

  container?: HTMLDivElement;

  private _idToManagedElement: Map<ManagedElementId, ManagedElement> = new Map();
  private _managedElementToId: Map<ManagedElement, ManagedElementId> = new Map();
  private _elementToId: Map<LayoutElement, ManagedElementId> = new Map();
  private _elementIds: ManagedElementId[] = [];
  private _lastId: ManagedElementId = 0n;

  addManagedElement(managedElement: ManagedElement) {
    const { element } = managedElement;
    if (this._managedElementToId.has(managedElement) ||
      this._elementToId.has(element)) {
      return undefined;
    }
    const id = this._lastId;
    ++this._lastId;

    this._idToManagedElement.set(id, managedElement);
    this._managedElementToId.set(managedElement, id);
    this._elementToId.set(element, id);
    this._elementIds.push(id);

    managedElement.layoutControlEventListener =
      (event: LayoutControlEvent) => {
        this.onLayoutControlEvent(event, managedElement);
      };

    element.addEventListener(
      "layoutcontrol",
      managedElement.layoutControlEventListener,
    );

    return id;
  }

  getManagedElementById(id: ManagedElementId) {
    return this._idToManagedElement.get(id);
  }

  removeManagedElementById(id: ManagedElementId) {
    const managedElement = this._idToManagedElement.get(id);
    if (!managedElement) {
      return false;
    }
    if (!this._managedElementToId.has(managedElement)) {
      throw new Error("missing key from _managedElementToId");
    }
    if (!this._elementToId.has(managedElement.element)) {
      throw new Error("missing key from _elementToId");
    }
    const index = this._elementIds.findIndex(storedId => storedId === id);
    if (index < 0) {
      throw new Error("missing id from _elementIds");
    }
    this._idToManagedElement.delete(id);
    this._managedElementToId.delete(managedElement);
    this._elementIds.splice(index);

    const { element, layoutControlEventListener } = managedElement;
    if (layoutControlEventListener) {
      this._elementToId.delete(element);
      element.removeEventListener(
        "layoutcontrol",
        layoutControlEventListener,
      );
    }

    return true;
  }

  getIdOfManagedElement(managedElement: ManagedElement) {
    return this._managedElementToId.get(managedElement);
  }

  getIdOfLayoutElement(element: LayoutElement) {
    return this._elementToId.get(element);
  }

  getManagedElementOfLayoutElement(element: LayoutElement):
    [bigint, ManagedElement] | undefined {
    const id = this._elementToId.get(element);
    if (id === undefined) {
      return undefined;
    }
    return [id, this._idToManagedElement.get(id)!];
  }

  get ids() {
    return this._elementIds;
  }

  get managedElements() {
    return this._elementIds.map(
      id => this._idToManagedElement.get(id)!
    );
  }

  managedElement(id: ManagedElementId | LayoutElement) {
    if (id instanceof LayoutElement) {
      return this.getManagedElementOfLayoutElement(id);
    }
    return this.getManagedElementById(id);
  }

  get layoutElements() {
    return this._elementIds.map(
      id => this._idToManagedElement.get(id)!.element
    );
  }

  layoutElement(id: ManagedElementId) {
    return this.getManagedElementById(id)?.element;
  }

  private captureIndex?: number;
  private capturePointerId?: number;
  private captureElement?: ManagedElement;
  private initialPoint: Point2D = { x: 0, y: 0 };

  private onLayoutControlEvent(
    event: LayoutControlEvent,
    element: ManagedElement,
  ) {
    if (!this.container) {
      return;
    }
    const { index, pointerEvent } = event;
    if (this.captureIndex === undefined) {
      if (pointerEvent.type !== "pointerdown") {
        return;
      }
      this.container.setPointerCapture(pointerEvent.pointerId);
      switch (index) {
        case 0: {
          this.style.cursor = "grabbing";
          break;
        }
        case 1:
        case 3: {
          this.style.cursor = "ns-resize";
          break;
        }
        case 2:
        case 4: {
          this.style.cursor = "ew-resize";
          break;
        }
        case 5:
        case 7: {
          this.style.cursor = "nwse-resize";
          break;
        }
        default: {
          this.style.cursor = "nesw-resize";
          break;
        }
      }
      this.captureIndex = index;
      this.capturePointerId = pointerEvent.pointerId;
      this.captureElement = element;
      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      return;
    }
    if (pointerEvent.pointerId !== this.capturePointerId) {
      return;
    }
    switch (pointerEvent.type) {
      case "pointerdown": {
        break;
      }
      case "pointermove": {
        const displacement = {
          x: pointerEvent.offsetX - this.initialPoint.x,
          y: pointerEvent.offsetY - this.initialPoint.y,
        }
        if (this.captureIndex === 0) {
          this.moveElement(displacement);
        } else {
          this.resizeElement(displacement);
        }
        break;
      }
      case "pointerup": {
        this.commitChange();
        break;
      }
      case "pointercancel": {
        this.cancelChange();
        break;
      }
    }
  }

  private onPointerEvent(event: PointerEvent) {
    if (this.captureIndex === undefined) {
      return;
    }
    if (event.pointerId !== this.capturePointerId) {
      return;
    }
    if (!this.container || event.target !== this.container) {
      return;
    }
    switch (event.type) {
      case "pointerdown": {
        break;
      }
      case "pointermove": {
        const displacement = {
          x: event.offsetX - this.initialPoint.x,
          y: event.offsetY - this.initialPoint.y,
        }
        if (this.captureIndex === 0) {
          this.moveElement(displacement);
        } else {
          this.resizeElement(displacement);
        }
        break;
      }
      case "pointerup": {
        this.commitChange();
        break;
      }
      case "pointercancel": {
        this.cancelChange();
        break;
      }
    }
  }

  private onGotPointerCapture(event: PointerEvent) {
    const element = this.captureElement;
    const id = element?.id;
    if (!element || (id === undefined)) {
      throw new Error("no valid element in onGotPointerCapture");
    }
    this.initialPoint = { x: event.offsetX, y: event.offsetY };
    this.capturePointerId = event.pointerId;
    const elementData = this.elementData(id);
    elementData.savedConfiguredRegion = element.region;
  }

  private onLostPointerCapture(event: PointerEvent) {
    this.style.cursor = "";
    this.cancelChange();
  }

  private cancelChange() {
    this.captureIndex = undefined;
    this.capturePointerId = undefined;
    const element = this.captureElement;
    if (!element) {
      return;
    }
    const id = element.id;
    if (id === undefined) {
      throw new Error("layoutElement doesn't have an id");
    }
    const elementData = this.elementData(id);
    if (elementData.savedConfiguredRegion) {
      element.region = elementData.savedConfiguredRegion;
    }
    this.captureElement = undefined;
  }

  private commitChange() {
    const element = this.captureElement;
    const id = element?.id;
    if (!element || (id === undefined)) {
      throw new Error("no valid element in commitChange");
      this.captureElement = undefined;
    }

  private moveElement(displacement: Point2D) {
    const configuredLayoutElement = this.captureElement;
    if (!configuredLayoutElement) {
      throw new Error("no valid element in moveElement")
    }
    const { element, region, id } = configuredLayoutElement;
    if (id === undefined) {
      throw new Error("no valid elementId in moveElement");
    }
    const { savedConfiguredRegion } = this.elementData(id);
    if (!savedConfiguredRegion) {
      throw new Error("no valid savedConfiguredRegion in moveElement")
    }

    const { start: left, length: width } = savedConfiguredRegion.actual[0];
    const { start: top, length: height } = savedConfiguredRegion.actual[1];
    if (left === undefined ||
      width === undefined ||
      top === undefined ||
      height === undefined) {
      throw new Error("no valid region in moveElement");
    }
    const movedRegion = {
      left: left + displacement.x,
      width,
      top: top + displacement.y,
      height,
    }
    const configuredRegion = this.context.getRootRelativeRegion(movedRegion);
    element.region = configuredLayoutElement.region = configuredRegion;
  }

  private resizeElement(displacement: Point2D) {

  }
}

export interface ElementConfiguration {
  aspectRatio?: number;
  configuredRegion?: ConfiguredRegion;
  metadata?: any;
}

export class ManagedElement {
  metadata?: any;
  element: LayoutElement;
  region: ConfiguredRegion;
  aspectRatio?: number;
  id?: number;
  layoutControlEventListener?: (event: LayoutControlEvent) => void;

  constructor(element: LayoutElement, region: ConfiguredRegion) {
    this.element = element;
    this.region = region;
    this.element.region = region;
  }

  loadConfiguredRegion() {
    this.element.region = this.region;
  }

  saveConfiguredRegion() {
    this.region = this.element.region;
  }
}

