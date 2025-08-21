import { css, html, LitElement, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { html as shtml } from "lit/static-html.js";
import { ConfiguredLayoutElement, ConfiguredRegion, LayoutContext } from "./layout-context";
import { LayoutControlEvent } from "./layout-element";
import { Point2D } from "../utils/geometry-2d";

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
      this.context.container = this.container;
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

  container?: HTMLDivElement;

  private _elements: Map<number, ConfiguredLayoutElement> = new Map();
  private _elementToId: Map<ConfiguredLayoutElement, number> = new Map();
  private _elementIds: number[] = [];
  private _lastId: number = 0;

  context: LayoutContext = new LayoutContext();

  constructor() {
    super();
  }

  addElement(element: ConfiguredLayoutElement) {
    const id = this.context.addElement(element);
    if (id === undefined) {
      return undefined;
    }
    this.context.useConfiguredRegionById(id);
    const listener = (e: Event) => {
      this.onLayoutControlEvent(e as LayoutControlEvent, element);
    };
    element.element.addEventListener("layoutcontrol", listener);
    this.elementData(id).controlListener = listener;
    this.requestUpdate();
    return id;
  }

  removeElementById(id: number) {
    if (!this.context) {
      return undefined;
    }
    const element = this.context.removeElementById(id);
    if (!element) {
      return undefined;
    }
    const listener = this.elementData(id).controlListener;
    if (listener) {
      element.element.removeEventListener("layoutcontrol", listener);
    }
    this.deleteElementData(id);
    this.requestUpdate();
    return element;

  }

  removeElement(element: ConfiguredLayoutElement) {
    if (!this.context) {
      return undefined;
    }
    const id = this.context.findElementId(element);
    if (id === undefined) {
      return undefined;
    }
    return this.removeElementById(id);
  }

  private idToElementData: Map<number, ElementData> = new Map();

  get elementIds() {
    return this.idToElementData.keys();
  }

  elementData(id: number) {
    const elementData = this.idToElementData.get(id);
    if (elementData) {
      return elementData;
    }
    const newData: ElementData = {};
    this.idToElementData.set(id, newData);
    return newData;
  }

  private deleteElementData(id: number) {
    this.idToElementData.delete(id);
  }

  saveConfiguredRegions() {
    if (!this.context) {
      return false;
    }
    for (const [id, elementData] of this.idToElementData) {
      const element = this.context.getElementById(id);
      if (!element) {
        continue;
      }
      elementData.savedConfiguredRegion = element.region;
    }
    return true;
  }

  private captureIndex?: number;
  private capturePointerId?: number;
  private captureElement?: ConfiguredLayoutElement;
  private initialPoint: Point2D = { x: 0, y: 0 };

  private onLayoutControlEvent(
    event: LayoutControlEvent,
    element: ConfiguredLayoutElement,
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
    }

    const elementData = this.elementData(id);
    elementData.savedConfiguredRegion = element.region;

    this.captureIndex = undefined;
    this.capturePointerId = undefined;
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

interface ElementData extends ElementConfiguration {
  element?: ConfiguredLayoutElement;
  controlListener?: (event: Event) => void;
  savedConfiguredRegion?: ConfiguredRegion;
}
