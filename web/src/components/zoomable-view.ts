import { centroid, dist, transformFromScreenCoordinates } from "../utils/geometry-2d";


const defaultAttributes: Record<string, any> = {
  "zoom-speed": 0.002,
  "min-zoom": 0.1,
  "max-zoom": 10,
  "current-zoom": 1,
  "view-margin-top": 0,
  "view-margin-right": 0,
  "view-margin-bottom": 0,
  "view-margin-left": 0,
  "view-offset-x": 0,
  "view-offset-y": 0,
};

type AttributeName = keyof typeof defaultAttributes;

export type Point2D = { x: number; y: number };

/**
 * Web component of a zoomable view.
 *
 * {@link ZoomableView} is a custom web element that supports zooming and panning.
 *
 * The structure of {@link ZoomableView} is as follows:
 * ```
 * <div id="container" part="container">
 *   <div id="background">
 *     <slot name="background"></slot>
 *   </div>
 *   <div id="content">
 *     <slot></slot>
 *   </div>
 * </div>
 * ```
 */
export class ZoomableView extends HTMLElement {

  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link ZoomableView} as a custom web component with tag
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
  static register(tagName: string = "zoomable-view"): string {
    if (!ZoomableView.tagName) {
      customElements.define(tagName, ZoomableView);
      ZoomableView.tagName = tagName;
      return tagName;
    } else {
      return ZoomableView.tagName;
    }
  }

  static readonly observedAttributes = Object.keys(defaultAttributes);

  container: HTMLDivElement;
  content: HTMLDivElement;
  background: HTMLDivElement;
  overlay: HTMLDivElement;

  constructor() {
    super();

    const template = document.createElement("template");
    template.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        #container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          isolation: isolate;
          overflow: hidden;
          touch-action: none;
        }
        #background {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: -1;
        }
        #overlay {
          position: absolute;
          pointer-events: none;
          width: 100%;
          height: 100%;
          z-index: 1;
        }
        #content {
          position: relative;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }
      </style>
      <div id="container" part="container">
        <div id="background">
          <slot name="background"></slot>
        </div>
        <div id="content">
          <slot></slot>
        </div>
        <div id="overlay">
          <slot name="overlay"></slot>
        </div>
      </div>
    `;

    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.append(template.content.cloneNode(true));

    const container = shadowRoot.getElementById("container") as HTMLDivElement;
    const content = shadowRoot.getElementById("content") as HTMLDivElement;
    const background = shadowRoot.getElementById(
      "background",
    ) as HTMLDivElement;
    const overlay = shadowRoot.getElementById("overlay") as HTMLDivElement;

    this.container = container;
    this.background = background;
    this.content = content;
    this.overlay = overlay;

    // Set up event listeners

    this.container.addEventListener("wheel", (e: Event) =>
      this.onWheelEvent(e),
    );

    const onPointerEvent = (e: Event) => this.onPointerEvent(e);
    this.container.addEventListener("pointerdown", onPointerEvent);
    this.container.addEventListener("pointerup", onPointerEvent);
    this.container.addEventListener("pointermove", onPointerEvent);
    this.container.addEventListener("pointercancel", onPointerEvent);

    const resizeObserver = new ResizeObserver(() => {
      this.onContentResized();
    });
    resizeObserver.observe(container, { box: "border-box" });
    resizeObserver.observe(content, { box: "border-box" });
  }

  protected getNumberAttribute(name: AttributeName): number {
    const num = Number.parseFloat(this.getAttribute(name)!);
    return Number.isNaN(num) ? defaultAttributes[name] : num;
  }

  get zoomSpeed(): number {
    return this.getNumberAttribute("zoom-speed");
  }
  set zoomSpeed(value: any) {
    this.setAttribute("zoom-speed", value.toString());
  }
  get minZoom(): number {
    return this.getNumberAttribute("min-zoom");
  }
  set minZoom(value: any) {
    this.setAttribute("min-zoom", value.toString());
  }
  get maxZoom(): number {
    return this.getNumberAttribute("max-zoom");
  }
  set maxZoom(value: any) {
    this.setAttribute("max-zoom", value.toString());
  }
  get currentZoom(): number {
    return this.getNumberAttribute("current-zoom");
  }
  set currentZoom(value: any) {
    this.setAttribute("current-zoom", value.toString());
  }
  get viewMarginTop(): number {
    return this.getNumberAttribute("view-margin-top");
  }
  set viewMarginTop(value: any) {
    this.setAttribute("view-margin-top", value.toString());
  }
  get viewMarginRight(): number {
    return this.getNumberAttribute("view-margin-right");
  }
  set viewMarginRight(value: any) {
    this.setAttribute("view-margin-right", value.toString());
  }
  get viewMarginBottom(): number {
    return this.getNumberAttribute("view-margin-bottom");
  }
  set viewMarginBottom(value: any) {
    this.setAttribute("view-margin-bottom", value.toString());
  }
  get viewMarginLeft(): number {
    return this.getNumberAttribute("view-margin-left");
  }
  set viewMarginLeft(value: any) {
    this.setAttribute("view-margin-left", value.toString());
  }
  get viewOffsetX(): number {
    return this.getNumberAttribute("view-offset-x");
  }
  set viewOffsetX(value: any) {
    this.setAttribute("view-offset-x", value.toString());
  }
  get viewOffsetY(): number {
    return this.getNumberAttribute("view-offset-y");
  }
  set viewOffsetY(value: any) {
    this.setAttribute("view-offset-y", value.toString());
  }
  minViewOffsetX: number = 0;
  maxViewOffsetX: number = 0;
  minViewOffsetY: number = 0;
  maxViewOffsetY: number = 0;

  connectedCallback() {
    this.update();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    switch (name) {
      case "current-zoom": {
        this.content.style.setProperty(
          "transform",
          `scale(${this.currentZoom})`,
        );
        this.updateViewOffsetBounds();
        this.validateViewOffsetX();
        this.validateViewOffsetY();
        break;
      }
      case "min-zoom":
      case "max-zoom": {
        this.validateZoom();
        this.updateViewOffsetBounds();
        this.validateViewOffsetX();
        this.validateViewOffsetY();
        break;
      }
      case "view-offset-x": {
        const viewOffsetX = Number.parseFloat(newValue);
        this.content.style.setProperty("left", `${viewOffsetX}px`);
        break;
      }
      case "view-offset-y": {
        const viewOffsetY = Number.parseFloat(newValue);
        this.content.style.setProperty("top", `${viewOffsetY}px`);
        break;
      }
      case "view-margin-top":
      case "view-margin-right":
      case "view-margin-bottom":
      case "view-margin-left": {
        this.updateViewOffsetBounds();
        this.validateViewOffsetX();
        this.validateViewOffsetY();
        break;
      }
    }
  }

  /**
   * Makes sure that `this[attr]`  is between `lowerBound` and `upperBound`.
   *
   * @param attr Name of the attribute whose value should be contained in an interval.
   * @param lowerBound The lower bound of the interval.
   * @param upperBound The upper bound of the interval.
   * @returns `true` iff `this[attr]` has been changed.
   */
  protected validateBoundedAttribute(
    attr: AttributeName,
    lowerBound: number,
    upperBound: number,
  ): boolean {
    const currentValue = this.getNumberAttribute(attr);
    const newValue = clamp(currentValue, lowerBound, upperBound);
    if (newValue === currentValue) {
      return false;
    }
    this.setAttribute(attr, newValue.toString());
    return true;
  }

  protected setBoundedAttribute(
    attr: AttributeName,
    newValue: number,
    lowerBound: number,
    upperBound: number,
  ): boolean {
    newValue = clamp(newValue, lowerBound, upperBound);
    if (this.getNumberAttribute(attr) === newValue) {
      return false;
    }
    this.setAttribute(attr, newValue.toString());
    return true;
  }

  setZoom(newZoom: number, keepCenter: boolean = true): boolean {
    if (keepCenter) {
      let currentZoom = this.currentZoom;
      const centerX = this.viewOffsetX / currentZoom;
      const centerY = this.viewOffsetY / currentZoom;

      let changed: boolean = false;
      changed ||= this.setBoundedAttribute(
        "current-zoom",
        newZoom,
        this.minZoom,
        this.maxZoom,
      );

      currentZoom = this.currentZoom;
      const newViewOffsetX = centerX * currentZoom;
      const newViewOffsetY = centerY * currentZoom;

      this.updateViewOffsetBounds();
      changed ||= this.setViewOffset(newViewOffsetX, newViewOffsetY);
      return changed;
    }
    return this.setBoundedAttribute(
      "current-zoom",
      newZoom,
      this.minZoom,
      this.maxZoom,
    );
  }

  protected validateZoom(): boolean {
    return this.validateBoundedAttribute(
      "current-zoom",
      this.minZoom,
      this.maxZoom,
    );
  }

  getScaleToFit(): number {
    return Math.min(
      this.container.clientWidth / this.content.offsetWidth,
      this.container.clientHeight / this.content.offsetHeight,
    );
  }

  zoomToFit(adjustBounds: boolean = false): boolean {
    const scaleToFit = this.getScaleToFit();
    if (adjustBounds) {
      if (scaleToFit > this.maxZoom) {
        this.maxZoom = scaleToFit;
      }
      if (scaleToFit < this.minZoom) {
        this.minZoom = scaleToFit;
      }
    }
    return this.setZoom(scaleToFit);
  }

  setViewOffsetX(newViewOffsetX: number): boolean {
    return this.setBoundedAttribute(
      "view-offset-x",
      newViewOffsetX,
      this.minViewOffsetX,
      this.maxViewOffsetX,
    );
  }

  setViewOffsetY(newViewOffsetY: number): boolean {
    return this.setBoundedAttribute(
      "view-offset-y",
      newViewOffsetY,
      this.minViewOffsetY,
      this.maxViewOffsetY,
    );
  }

  setViewOffset(newViewOffsetX: number, newViewOffsetY: number) {
    const offsetXUpdated = this.setViewOffsetX(newViewOffsetX);
    const offsetYUpdated = this.setViewOffsetY(newViewOffsetY);
    return offsetXUpdated || offsetYUpdated;
  }

  scrollView(deltaX?: number, deltaY?: number) {
    if (deltaX != null) {
      this.setViewOffsetX(
        clamp(
          this.viewOffsetX + deltaX,
          this.minViewOffsetX,
          this.maxViewOffsetX,
        ),
      );
    }
    if (deltaY != null) {
      this.setViewOffsetY(
        clamp(
          this.viewOffsetY + deltaY,
          this.minViewOffsetY,
          this.maxViewOffsetY,
        ),
      );
    }
  }

  protected updateViewOffsetBounds() {
    const currentZoom = this.currentZoom;

    const halfContainerWidth = 0.5 * this.container.clientWidth;
    const halfContentOffsetWidth = 0.5 * this.content.offsetWidth;

    // Compute the length of `content` (including `viewLeftMargin`) on the left
    // of the origin.
    const leftContentWidth = halfContentOffsetWidth + this.viewMarginLeft;
    // Excess is positive if the left side of the content spills cannot be
    // contained inside `container`; otherwise it is negative, and its absolute
    // value is the leftover space that `container` has on the left of
    // `content`.
    const leftExcess = leftContentWidth * currentZoom - halfContainerWidth;

    // Compute the same 2 numbers as above for the right side.
    const rightContentWidth = halfContentOffsetWidth + this.viewMarginRight;
    const rightExcess = rightContentWidth * currentZoom - halfContainerWidth;

    // Note: the following may be non-trivial.
    //
    // `minViewOffsetX` determines how far left scrolling can go.
    // The more negative `minViewOffsetX` is, the further left scrolling can go.
    //
    // `minViewOffsetX` must be negative enough to allow the user to see the
    // right portion of `content` (including `viewRightMargin`). This
    // corresponds to the term `-rightExcess` in the expression below. If
    // `rightExcess` is larger (more positive), we can scroll more.
    //
    // Although the condition above is in fact sufficient, we allow additional
    // scrolling when `content` is smaller than `container`, i.e., there is
    // some leftover area on the left of `content`. We let left scrolling go
    // far enough to see the full left part of `content` including
    // `viewLeftMargin`. This corresponds to the term `leftExcess` in the
    // expression below.
    this.minViewOffsetX = Math.min(leftExcess, -rightExcess);
    // The formula for `maxViewOffsetX` is derived in a similar fashion.
    this.maxViewOffsetX = Math.max(leftExcess, -rightExcess);

    // Now we do the same thing with the y-axis.
    const halfContainerHeight = 0.5 * this.container.clientHeight;
    const halfContentOffsetHeight = 0.5 * this.content.offsetHeight;

    const topContentHeight =
      halfContentOffsetHeight + this.viewMarginTop * currentZoom;
    const topExcess = topContentHeight * currentZoom - halfContainerHeight;

    const bottomContentHeight =
      halfContentOffsetHeight + this.viewMarginBottom * currentZoom;
    const bottomExcess =
      bottomContentHeight * currentZoom - halfContainerHeight;

    this.minViewOffsetY = Math.min(topExcess, -bottomExcess);
    this.maxViewOffsetY = Math.max(topExcess, -bottomExcess);
  }

  protected validateViewOffsetX(): boolean {
    return this.validateBoundedAttribute(
      "view-offset-x",
      this.minViewOffsetX,
      this.maxViewOffsetX,
    );
  }

  protected validateViewOffsetY(): boolean {
    return this.validateBoundedAttribute(
      "view-offset-y",
      this.minViewOffsetY,
      this.maxViewOffsetY,
    );
  }

  /**
   * Forces the component to update.
   */
  update() {
    this.updateViewOffsetBounds();
    this.validateZoom();
    this.validateViewOffsetX();
    this.validateViewOffsetY();
  }

  protected onContentResized() {
    this.updateViewOffsetBounds();
  }

  protected onWheelEvent(e: Event) {
    const event = e as WheelEvent;
    if (event.deltaY != null) {
      setTimeout(() => { }, 0);
      let deltaY = event.deltaY;
      switch (event.deltaMode) {
        // It is unclear if this will ever happen.
        // We use the same fallback logic as `DOM_DELTA_LINE` for now.
        case WheelEvent.DOM_DELTA_PAGE:
        case WheelEvent.DOM_DELTA_LINE: {
          // TODO: Replace 17 with a not-so-magic number.
          // This is a workaround for Firefox as it seems like only Firefox
          // fires this event with `deltaMode = DOM_DELTA_LINE`.
          deltaY = event.deltaY * 17;
          break;
        }
      }
      const newZoom = this.currentZoom * 2 ** (-this.zoomSpeed * deltaY);
      this.setZoom(newZoom);
      event.preventDefault();
    }
  }

  protected pointers: { id: number; x: number; y: number }[] = [];

  protected pointerScrolling: boolean = false;
  protected pointerScrollTracking: boolean = false;
  protected pointerLastCentroid: Point2D = { x: 0, y: 0 };

  protected pointerZooming: boolean = false;
  protected pointerZoomTracking: boolean = false;
  protected pointerLastRadius: number = 0;

  protected onPointerEvent(e: Event) {
    const event = e as PointerEvent;
    const pointer = {
      id: event.pointerId,
      ...transformFromScreenCoordinates(this, event.pageX, event.pageY),
    };

    if (event.type === "pointerdown") {
      this.pointers.push(pointer);
      if (this.pointers.length === 1) {
        // Start scrolling
        this.pointerScrolling = true;
      } else if (this.pointers.length === 2) {
        // Start zooming
        this.pointerZooming = true;
      }
      this.pointerLastCentroid = centroid(this.pointers);
      this.pointerLastRadius = average(
        this.pointers.map((p) => dist(p, this.pointerLastCentroid)),
      );
      event.preventDefault();
    } else {
      const index = this.pointers.findIndex((pe) => pe.id === pointer.id);
      if (index < 0) {
        return;
      }
      switch (event.type) {
        case "pointermove": {
          this.container.setPointerCapture(event.pointerId);
          const newCentroid = centroid(this.pointers);
          this.pointers[index] = pointer;
          if (this.pointerScrolling) {
            this.scrollView(
              newCentroid.x - this.pointerLastCentroid.x,
              newCentroid.y - this.pointerLastCentroid.y,
            );
            this.pointerLastCentroid = newCentroid;
            this.container.style.cursor = "grabbing";
          }
          if (this.pointerZooming) {
            const newRadius = average(
              this.pointers.map((p) => dist(p, newCentroid)),
            );
            const zoomMultiple = newRadius / this.pointerLastRadius;
            this.setZoom(this.currentZoom * zoomMultiple);
            this.pointerLastRadius = newRadius;
          }
          event.preventDefault();
          event.stopPropagation();
          break;
        }
        case "pointercancel":
        case "pointerup": {
          // Tracking is reset every time a pointer is removed.
          this.pointers.splice(index, 1);
          if (this.pointers.length === 1) {
            this.pointerZooming = false;
          } else if (this.pointers.length === 0) {
            this.pointerScrolling = false;
            this.container.style.cursor = "";
          }
          this.pointerLastCentroid = centroid(this.pointers);
          this.pointerLastRadius = average(
            this.pointers.map((p) => dist(p, this.pointerLastCentroid)),
          );
          event.preventDefault();
          event.stopPropagation();
          break;
        }
      }
    }
  }
}

/**
 * Clamps `value` to be inside `[lowerBound, upperBound]`.
 *
 * If `upperBound < lowerBound`, `lowerBound` will be returned.
 */
function clamp(value: number, lowerBound: number, upperBound: number): number {
  return Math.max(Math.min(value, upperBound), lowerBound);
}

function average(nums: Iterable<number>): number {
  let i = 0;
  let sum = 0;
  for (const num of nums) {
    sum += num;
    ++i;
  }
  return i === 0 ? 0 : sum / i;
}

