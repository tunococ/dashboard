import { transformFromScreenCoordinates } from "../browser-utils/positioning.ts";
import { type Point2D, cross } from "../utils/geometry-2d.ts";

export interface ResizerConfig {
  resizable: boolean;
  maintainAspectRatio: boolean;
  aspectRatio: number;
  aspectRatioOffsetWidth: number;
  aspectRatioOffsetHeight: number;
  resizeBorderWidth: string | number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  expandLimitTop: number;
  expandLimitRight: number;
  expandLimitBottom: number;
  expandLimitLeft: number;
  zIndex: string;
}

type ConfigKey = keyof ResizerConfig;

export interface ResizeEventDetail {
  /**
   * A number indicating the direction of resizing.
   *
   * -1: undefined
   * 0: top
   * 1: top-right
   * 2: right
   * 3: bottom-right
   * 4: bottom
   * 5: bottom-left
   * 6: left
   * 7: top-left
   */
  resizeDirection: number;
  maintainAspectRatio: boolean;
  aspectRatio: number;
  aspectRatioOffsetWidth: number;
  aspectRatioOffsetHeight: number;
  width: number;
  height: number;
  initialWidth: number;
  initialHeight: number;
  resizer: Resizer;
}

export type ResizeEventType =
  | "resizestart"
  | "resizeend"
  | "resizecancel"
  | "resize"
  | "resized";

export class ResizeEvent extends Event implements ResizeEventDetail {
  resizeDirection: number;
  maintainAspectRatio: boolean;
  aspectRatio: number;
  aspectRatioOffsetWidth: number;
  aspectRatioOffsetHeight: number;
  width: number;
  height: number;
  initialWidth: number;
  initialHeight: number;
  resizer: Resizer;
  constructor(
    type: ResizeEventType,
    options: Partial<ResizeEventDetail> & { resizer: Resizer },
  ) {
    super(type); // This event does not bubble.
    this.resizeDirection = options.resizeDirection ?? -1;
    this.maintainAspectRatio = options.maintainAspectRatio ?? false;
    this.aspectRatio = options.aspectRatio ?? 1;
    this.aspectRatioOffsetWidth = options.aspectRatioOffsetWidth ?? 0;
    this.aspectRatioOffsetHeight = options.aspectRatioOffsetHeight ?? 0;
    this.width = options.width ?? -1;
    this.height = options.height ?? -1;
    this.initialWidth = options.initialWidth ?? -1;
    this.initialHeight = options.initialHeight ?? -1;
    this.resizer = options.resizer;
  }

  get isCornerResizing(): boolean {
    return [1, 3, 5, 7].includes(this.resizeDirection);
  }
}

export type AspectRatioFitStrategy =
  | "fix-width"
  | "fix-height"
  | "fix-diagonal"
  | "fix-area"
  | "fix-circumference";

const POINTER_EVENT_TYPES = [
  "pointermove",
  "pointerdown",
  "pointerup",
  "pointerenter",
  "pointerleave",
  "pointerover",
  "pointerout",
  "pointercancel",
];

export class Resizer implements ResizerConfig {
  private _resizable: boolean = true;
  private _maintainAspectRatio: boolean = false;
  resizeBorderWidth: number | string = "1px";
  minWidth: number = 1;
  minHeight: number = 1;
  maxWidth: number = Number.POSITIVE_INFINITY;
  maxHeight: number = Number.POSITIVE_INFINITY;
  expandLimitTop: number = Number.POSITIVE_INFINITY;
  expandLimitRight: number = Number.POSITIVE_INFINITY;
  expandLimitBottom: number = Number.POSITIVE_INFINITY;
  expandLimitLeft: number = Number.POSITIVE_INFINITY;
  zIndex: string = "2147483647";
  private _aspectRatio: number = 1;
  aspectRatioOffsetWidth: number = 0;
  aspectRatioOffsetHeight: number = 0;

  get resizable(): boolean {
    return this._resizable;
  }
  set resizable(v: boolean) {
    this._resizable = v;
    this.updateResizeControls();
  }
  get maintainAspectRatio(): boolean {
    return this._maintainAspectRatio;
  }
  set maintainAspectRatio(v: boolean) {
    this._maintainAspectRatio = v;
    this.updateResizeControls();
    if (v) {
      this.fitAspectRatio();
    }
  }
  get aspectRatio(): number {
    return this._aspectRatio;
  }
  set aspectRatio(v: number) {
    if (!(v > 0)) {
      throw `aspectRatio must be postive`;
    }
    this._aspectRatio = v;
    if (this._maintainAspectRatio) {
      this.fitAspectRatio();
    }
  }

  get element(): HTMLElement | undefined {
    return this._element;
  }
  set element(v: HTMLElement) {
    this.attach(v);
  }

  constructor(config: Partial<ResizerConfig> = {}) {
    for (const key in config) {
      (this as any)[key] = config[key as ConfigKey];
    }
  }

  getConfig(): ResizerConfig {
    return {
      resizable: this.resizable,
      maintainAspectRatio: this.maintainAspectRatio,
      aspectRatio: this.aspectRatio,
      aspectRatioOffsetWidth: this.aspectRatioOffsetWidth,
      aspectRatioOffsetHeight: this.aspectRatioOffsetHeight,
      resizeBorderWidth: this.resizeBorderWidth,
      minWidth: this.minWidth,
      minHeight: this.minHeight,
      maxWidth: this.maxWidth,
      maxHeight: this.maxHeight,
      expandLimitTop: this.expandLimitTop,
      expandLimitRight: this.expandLimitRight,
      expandLimitBottom: this.expandLimitBottom,
      expandLimitLeft: this.expandLimitLeft,
      zIndex: this.zIndex,
    };
  }

  private _detach: (() => void) | undefined = undefined;
  private _element: HTMLElement | undefined;

  /*
   * 12 elements will be added around the corner of the element to capture
   * pointer events. These elements are indexed as follows:
   *
   *           Top-left corner          Midpoint        Top-right corner
   *
   *                 10                    |                    1
   *                             11        |        0
   *
   *                    9                                     2
   *
   *       Midpoint  ----                                     ----  Midpoint
   *
   *                    8                                     3
   *
   *                              6        |        5
   *                  7                    |                    4
   *
   *         Bottom-left corner         Midpoint       Bottom-right corner
   *
   * The border elements (0, 2, 3, 5, 6, 8, 9, 11) will behave differently
   * based on `maintainAspectRatio` as follows:
   *
   * - If `maintainAspectRatio === false`, the border elements will handle
   *   resizing in only one dimension.
   * - If `maintainAspectRatio === false`, the border elements will behave like
   *   its adjacent corner element.
   *
   * The corner elements (1, 4, 7, 10) will handle resizing in both dimensions
   * (width and height).
   *
   * - If `maintainAspectRatio === false`, the width and the height of the
   *   element can be modified independently.
   * - If `maintainAspectRatio === true`, the aspect ratio will determine the
   *   drag direction for resizing.
   */
  private resizeControls: HTMLElement[] = [];

  attach(element: HTMLElement): () => void {
    this.detach();
    if (!element.offsetParent) {
      throw "Resizer cannot attach to an element without offsetParent";
    }
    if (getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }
    element.style.boxSizing = "border-box";

    // Add elements to capture clicking + dragging on the border.
    const resizeBorderWidth =
      typeof this.resizeBorderWidth === "number"
        ? `${this.resizeBorderWidth}px`
        : this.resizeBorderWidth;
    const resizeControls: HTMLElement[] = new Array(12);
    for (const i of [0, 2, 3, 5, 6, 8, 9, 11, 1, 4, 7, 10]) {
      const resizeControl = document.createElement("div");
      resizeControl.style.display = "none";
      resizeControl.style.pointerEvents = "none";
      resizeControl.style.border = "0";
      resizeControl.style.margin = "0";
      resizeControl.style.padding = "0";
      resizeControl.style.opacity = "0";
      resizeControl.style.position = "absolute";
      resizeControl.style.top = "";
      resizeControl.style.right = "";
      resizeControl.style.bottom = "";
      resizeControl.style.left = "";
      resizeControl.style.width = "50%";
      resizeControl.style.height = "50%";
      resizeControl.style.zIndex = this.zIndex.toString();

      // Set up anchors.
      if (i <= 2) {
        resizeControl.style.top = resizeControl.style.right = "0";
      } else if (i <= 5) {
        resizeControl.style.right = resizeControl.style.bottom = "0";
      } else if (i <= 8) {
        resizeControl.style.bottom = resizeControl.style.left = "0";
      } else {
        resizeControl.style.left = resizeControl.style.top = "0";
      }

      // Set up sizes.
      if (i >= 10 || i <= 1) {
        resizeControl.style.height = resizeBorderWidth;
      }
      if (i >= 1 && i <= 4) {
        resizeControl.style.width = resizeBorderWidth;
      }
      if (i >= 4 && i <= 7) {
        resizeControl.style.height = resizeBorderWidth;
      }
      if (i >= 7 && i <= 10) {
        resizeControl.style.width = resizeBorderWidth;
      }

      element.appendChild(resizeControl);
      resizeControls[i] = resizeControl;
    }

    const listener = (event: PointerEvent) => this.onPointerEvent(event);
    for (const resizeControl of resizeControls) {
      for (const type of POINTER_EVENT_TYPES) {
        resizeControl.addEventListener(type, listener as any);
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      element.dispatchEvent(
        new ResizeEvent("resized", {
          resizer: this,
          maintainAspectRatio: false,
          width: element.offsetWidth,
          height: element.offsetHeight,
        }),
      );
    });
    resizeObserver.observe(element, { box: "border-box" });

    this._element = element;
    this.resizeControls = resizeControls;

    this._detach = () => {
      resizeObserver.disconnect();

      for (const resizeControl of resizeControls) {
        try {
          element.removeChild(resizeControl);
        } catch (_e) { }
      }
    };

    this.updateResizeControls();
    return () => {
      this.detach();
    };
  }

  detach() {
    if (this._detach) {
      this._detach();
      this._detach = undefined;
    }
    this._element = undefined;
    this.resizeControls = [];
  }

  updateResizeControls() {
    if (this.resizable && this.resizeControls.length === 12) {
      for (const resizeControl of this.resizeControls) {
        resizeControl.style.removeProperty("cursor");
        resizeControl.style.pointerEvents = "auto";
        resizeControl.style.display = "block";
      }
      this.resizeControls[0].style.cursor = this.maintainAspectRatio
        ? "nesw-resize"
        : "ns-resize";
      this.resizeControls[1].style.cursor = "nesw-resize";
      this.resizeControls[2].style.cursor = this.maintainAspectRatio
        ? "nesw-resize"
        : "ew-resize";
      this.resizeControls[3].style.cursor = this.maintainAspectRatio
        ? "nwse-resize"
        : "ew-resize";
      this.resizeControls[4].style.cursor = "nwse-resize";
      this.resizeControls[5].style.cursor = this.maintainAspectRatio
        ? "nwse-resize"
        : "ns-resize";
      for (let i = 0; i < 6; ++i) {
        this.resizeControls[i + 6].style.cursor =
          this.resizeControls[i].style.cursor;
      }
    } else {
      for (const resizeControl of this.resizeControls) {
        resizeControl.style.removeProperty("cursor");
        resizeControl.style.pointerEvents = "none";
        resizeControl.style.display = "none";
      }
    }
  }

  resize(
    params: { width?: string | number; height?: string | number },
    direction: number = -1,
  ) {
    if (!this._element) {
      return false;
    }
    const newWidth =
      typeof params.width === "number" ? `${params.width}px` : params.width;
    const newHeight =
      typeof params.height === "number" ? `${params.height}px` : params.height;
    if (direction === -1) {
      if (newWidth) {
        this._element.style.width = newWidth;
      }
      if (newHeight) {
        this._element.style.height = newHeight;
      }
      return true;
    }

    const computedStyle = getComputedStyle(this._element);
    const top = computedStyle.top;
    const right = computedStyle.right;
    const bottom = computedStyle.bottom;
    const left = computedStyle.left;

    if (direction === 7 || direction <= 1) {
      this._element.style.bottom = bottom;
      this._element.style.top = "";
    } else if (direction >= 3 && direction <= 5) {
      this._element.style.top = top;
      this._element.style.bottom = "";
    }
    if (direction >= 1 && direction <= 3) {
      this._element.style.left = left;
      this._element.style.right = "";
    } else if (direction >= 5) {
      this._element.style.right = right;
      this._element.style.left = "";
    }

    if (newWidth && direction !== 0 && direction !== 4) {
      this._element.style.width = newWidth;
    }
    if (newHeight && direction !== 2 && direction !== 6) {
      this._element.style.height = newHeight;
    }
    return true;
  }

  findSizeForAspectRatio(strategy: AspectRatioFitStrategy):
    | {
      width: number;
      height: number;
    }
    | undefined {
    if (!this._element || !(this.aspectRatio > 0)) {
      return undefined;
    }
    const aspectRatio = this.aspectRatio;
    const baseWidth = this._element.offsetWidth - this.aspectRatioOffsetWidth;
    const baseHeight =
      this._element.offsetHeight - this.aspectRatioOffsetHeight;
    let newBaseHeight = baseHeight;
    switch (strategy) {
      case "fix-width": {
        newBaseHeight = baseWidth / aspectRatio;
        break;
      }
      case "fix-height": {
        break;
      }
      case "fix-diagonal": {
        newBaseHeight = Math.sqrt(
          (baseWidth ** 2 + baseHeight ** 2) / (aspectRatio ** 2 + 1),
        );
        break;
      }
      case "fix-area": {
        newBaseHeight = Math.sqrt((baseWidth * baseHeight) / aspectRatio);
        break;
      }
      case "fix-circumference": {
        newBaseHeight = (baseWidth + baseHeight) / (1 + aspectRatio);
        break;
      }
    }
    newBaseHeight = clamp(
      newBaseHeight,
      Math.max(this.minHeight - this.aspectRatioOffsetHeight, 1),
      this.maxHeight - this.aspectRatioOffsetHeight,
    );
    const newBaseWidth = clamp(
      newBaseHeight * aspectRatio,
      Math.max(this.minWidth - this.aspectRatioOffsetWidth, 1),
      this.maxWidth - this.aspectRatioOffsetWidth,
    );

    return {
      width: newBaseWidth + this.aspectRatioOffsetWidth,
      height: newBaseHeight + this.aspectRatioOffsetHeight,
    };
  }

  fitAspectRatio(
    direction: number = -1,
    strategy: AspectRatioFitStrategy = "fix-diagonal",
  ): boolean {
    const size = this.findSizeForAspectRatio(strategy);
    if (!size) {
      return false;
    }
    return this.resize(size, direction);
  }

  /**
   * Resizes the attached element to the given aspect ratio.
   *
   * This will resize the element using the given `direction` and `strategy`.
   * Note that calling this function does not automatically set
   * {@link maintainAspectRatio} to `true`.
   * In fact, this function should be called before changing
   * `maintainAspectRatio` from `false` to `true` to minimize visual
   * disruption.
   */
  setAspectRatio(
    aspectRatio: number,
    direction: number = -1,
    strategy:
      | "fix-width"
      | "fix-height"
      | "fix-diagonal"
      | "fix-area"
      | "fix-circumference" = "fix-diagonal",
  ): boolean {
    this._aspectRatio = aspectRatio;
    return this.fitAspectRatio(direction, strategy);
  }

  private resizingIndex: number = -1;
  private resizingElement: HTMLElement | undefined;
  private resizingInitialPoint: Point2D = { x: 0, y: 0 };
  private resizingInitialWidth: number = 0;
  private resizingInitialHeight: number = 0;
  private resizingWidthDirection: number = 0;
  private resizingHeightDirection: number = 0;

  onPointerEvent(event: PointerEvent) {
    if (!this._element || !this.resizable || !event.isPrimary) {
      return;
    }
    const pointerPosition = transformFromScreenCoordinates(
      this._element,
      event.screenX,
      event.screenY,
    );
    const computedStyle = getComputedStyle(this._element);
    const top = computedStyle.top;
    const right = computedStyle.right;
    const bottom = computedStyle.bottom;
    const left = computedStyle.left;
    const width = this._element.offsetWidth;
    const height = this._element.offsetHeight;
    switch (event.type) {
      case "pointerdown": {
        const index = this.resizeControls.findIndex(
          (resizeControl) => resizeControl === event.target,
        );
        if (index in this.resizeControls) {
          this.resizingIndex = index;
          this.resizingElement = this.resizeControls[index];
          this.resizingInitialPoint = pointerPosition;
          this.resizingInitialWidth = clamp(
            width,
            this.minWidth,
            this.maxWidth,
          );
          this.resizingInitialHeight = clamp(
            height,
            this.minHeight,
            this.maxHeight,
          );
          this.resizingWidthDirection = 0;
          this.resizingHeightDirection = 0;

          if (this.maintainAspectRatio) {
            if (index <= 5) {
              this._element.style.right = "";
              this._element.style.left = left;
              this.resizingWidthDirection = 1;
            } else {
              this._element.style.left = "";
              this._element.style.right = right;
              this.resizingWidthDirection = -1;
            }
            if (index <= 2 || index >= 9) {
              this._element.style.top = "";
              this._element.style.bottom = bottom;
              this.resizingHeightDirection = -1;
            } else {
              this._element.style.bottom = "";
              this._element.style.top = top;
              this.resizingHeightDirection = 1;
            }
            this._element.style.width = `${width}px`;
            this._element.style.height = `${height}px`;
          } else {
            if (index <= 1 || index >= 10) {
              this._element.style.bottom = bottom;
              this._element.style.top = "";
              this._element.style.height = `${height}px`;
              this.resizingHeightDirection = -1;
            } else if (index >= 4 && index <= 8) {
              this._element.style.top = top;
              this._element.style.bottom = "";
              this._element.style.height = `${height}px`;
              this.resizingHeightDirection = 1;
            }
            if (index >= 1 && index <= 4) {
              this._element.style.left = left;
              this._element.style.right = "";
              this._element.style.width = `${width}px`;
              this.resizingWidthDirection = 1;
            } else if (index >= 7 && index <= 10) {
              this._element.style.right = right;
              this._element.style.left = "";
              this._element.style.width = `${width}px`;
              this.resizingWidthDirection = -1;
            }
          }

          this.resizingElement.setPointerCapture(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
          this._element.dispatchEvent(
            new ResizeEvent("resizestart", {
              resizer: this,
              maintainAspectRatio: this.maintainAspectRatio,
              resizeDirection: getResizeDirection(
                this.resizingWidthDirection,
                this.resizingHeightDirection,
              ),
              width,
              height,
              initialWidth: width,
              initialHeight: height,
            }),
          );
        }
        break;
      }
      case "pointercancel": {
        const index = this.resizingIndex;
        if (index in this.resizeControls) {
          if (this.resizingWidthDirection !== 0) {
            this._element.style.width = `${this.resizingInitialWidth}px`;
          }
          if (this.resizingHeightDirection !== 0) {
            this._element.style.height = `${this.resizingInitialHeight}px`;
          }
          this.resizingElement?.releasePointerCapture(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
          this._element.dispatchEvent(
            new ResizeEvent("resizecancel", {
              resizer: this,
              maintainAspectRatio: this.maintainAspectRatio,
              resizeDirection: getResizeDirection(
                this.resizingWidthDirection,
                this.resizingHeightDirection,
              ),
              width: this.resizingInitialWidth,
              height: this.resizingInitialHeight,
              initialWidth: this.resizingInitialWidth,
              initialHeight: this.resizingInitialHeight,
            }),
          );
        }
        this.resizingElement = undefined;
        this.resizingIndex = -1;
        break;
      }
      case "pointerup": {
        if (this.resizingIndex >= 0) {
          this.resizingElement?.releasePointerCapture(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
          this._element.dispatchEvent(
            new ResizeEvent("resizeend", {
              resizer: this,
              maintainAspectRatio: this.maintainAspectRatio,
              resizeDirection: getResizeDirection(
                this.resizingWidthDirection,
                this.resizingHeightDirection,
              ),
              width,
              height,
              initialWidth: this.resizingInitialWidth,
              initialHeight: this.resizingInitialHeight,
            }),
          );
        }
        this.resizingElement = undefined;
        this.resizingIndex = -1;
        break;
      }
      case "pointermove": {
        const index = this.resizingIndex;
        if (index in this.resizeControls) {
          const displacement = {
            x: pointerPosition.x - this.resizingInitialPoint.x,
            y: pointerPosition.y - this.resizingInitialPoint.y,
          };

          let targetBaseWidth: number;
          let targetBaseHeight: number;
          let targetWidth: number;
          let targetHeight: number;

          const expandLimitWidth =
            this.resizingInitialWidth +
            (index <= 5 ? this.expandLimitRight : this.expandLimitLeft);
          const expandLimitHeight =
            this.resizingInitialHeight +
            (index >= 3 && index <= 8
              ? this.expandLimitBottom
              : this.expandLimitTop);
          if (this.maintainAspectRatio) {
            let baseWidth =
              this.resizingInitialWidth - this.aspectRatioOffsetWidth;
            let baseHeight =
              this.resizingInitialHeight - this.aspectRatioOffsetHeight;
            const cornerDirection = {
              x: baseWidth * this.resizingWidthDirection,
              y: baseHeight * this.resizingHeightDirection,
            };
            // Make sure baseWidth and baseHeight are positive.
            if (baseWidth <= 0 || baseHeight <= 0) {
              if (this.aspectRatio < 1) {
                baseWidth = 1;
                baseHeight = 1 / this.aspectRatio;
              } else {
                baseHeight = 1;
                baseWidth = this.aspectRatio;
              }
            }
            let useX: boolean;
            if (index === 1 || index === 7) {
              useX = cross(displacement, cornerDirection) < 0;
            } else if (index === 4 || index === 10) {
              useX = cross(displacement, cornerDirection) > 0;
            } else if (
              index === 2 ||
              index === 3 ||
              index === 8 ||
              index === 9
            ) {
              useX = true;
            } else {
              useX = false;
            }
            if (useX) {
              targetBaseWidth = clamp(
                baseWidth + this.resizingWidthDirection * displacement.x,
                Math.max(this.minWidth - this.aspectRatioOffsetWidth, 1),
                this.maxWidth - this.aspectRatioOffsetWidth,
              );
              targetBaseHeight = targetBaseWidth / this.aspectRatio;
            } else {
              targetBaseHeight = clamp(
                baseHeight + this.resizingHeightDirection * displacement.y,
                Math.max(this.minHeight - this.aspectRatioOffsetHeight, 1),
                this.maxHeight - this.aspectRatioOffsetHeight,
              );
              targetBaseWidth = targetBaseHeight * this.aspectRatio;
            }
            if (
              targetBaseHeight >
              expandLimitHeight - this.aspectRatioOffsetHeight
            ) {
              targetBaseHeight = Math.max(
                expandLimitHeight - this.aspectRatioOffsetHeight,
                1,
              );
              targetBaseWidth = targetBaseHeight * this.aspectRatio;
            }
            if (
              targetBaseWidth >
              expandLimitWidth - this.aspectRatioOffsetWidth
            ) {
              targetBaseWidth = Math.max(
                expandLimitWidth - this.aspectRatioOffsetWidth,
                1,
              );
              targetBaseHeight = targetBaseWidth / this.aspectRatio;
            }
            targetWidth = targetBaseWidth + this.aspectRatioOffsetWidth;
            targetHeight = targetBaseHeight + this.aspectRatioOffsetHeight;
          } else {
            targetWidth = Math.min(
              this.resizingInitialWidth +
              displacement.x * this.resizingWidthDirection,
              expandLimitWidth,
            );
            targetHeight = Math.min(
              this.resizingInitialHeight +
              displacement.y * this.resizingHeightDirection,
              expandLimitHeight,
            );
          }
          if (this.resizingWidthDirection !== 0) {
            targetWidth = clamp(targetWidth, this.minWidth, this.maxWidth);
            this._element.style.width = `${targetWidth}px`;
          }
          if (this.resizingHeightDirection !== 0) {
            targetHeight = clamp(targetHeight, this.minHeight, this.maxHeight);
            this._element.style.height = `${targetHeight}px`;
          }

          event.preventDefault();
          event.stopPropagation();
          this._element.dispatchEvent(
            new ResizeEvent("resize", {
              resizer: this,
              maintainAspectRatio: this.maintainAspectRatio,
              resizeDirection: getResizeDirection(
                this.resizingWidthDirection,
                this.resizingHeightDirection,
              ),
              width,
              height,
              initialWidth: this.resizingInitialWidth,
              initialHeight: this.resizingInitialHeight,
            }),
          );
        }
        break;
      }
    }
  }
}

function getResizeDirection(hDir: number, vDir: number): number {
  if (vDir < 0) {
    return hDir < 0 ? 7 : hDir > 0 ? 1 : 0;
  }
  if (vDir > 0) {
    return hDir < 0 ? 5 : hDir > 0 ? 3 : 4;
  }
  return hDir < 0 ? 6 : hDir > 0 ? 2 : -1;
}

/**
 * Clamps `value` to be inside `[lowerBound, upperBound]`.
 *
 * If `upperBound < lowerBound`, `lowerBound` will be returned.
 */
function clamp(value: number, lowerBound: number, upperBound: number): number {
  return Math.max(Math.min(value, upperBound), lowerBound);
}
