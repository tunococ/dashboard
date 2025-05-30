import { Point2D, transformFromScreenCoordinates } from "../utils/geometry-2d";

export interface MoveEventDetail {
  initialX: number;
  initialY: number;
  displacementX: number;
  displacementY: number;
  mover: Mover;
}

export type MoveEventType = "movestart" | "moveend" | "movecancel" | "move";

export class MoveEvent extends Event implements MoveEventDetail {
  initialX: number;
  initialY: number;
  displacementX: number;
  displacementY: number;
  mover: Mover;
  constructor(type: MoveEventType, options: Partial<MoveEventDetail> & { mover: Mover }) {
    super(type);
    this.initialX = options.initialX ?? NaN;
    this.initialY = options.initialY ?? NaN;
    this.displacementX = options.displacementX ?? 0;
    this.displacementY = options.displacementY ?? 0;
    this.mover = options.mover;
  }
}

export interface MoverConfig {
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  zIndex: number;
}

type ConfigKey = keyof MoverConfig;

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

export class Mover {
  marginTop: number = 0;
  marginRight: number = 0;
  marginBottom: number = 0;
  marginLeft: number = 0;
  zIndex: string = "2147483646";
  private _movable: boolean = true;

  get movable(): boolean {
    return this._movable;
  }
  set movable(v: boolean) {
    this._movable = v;
    this.updateMoveControl();
  }

  get element(): HTMLElement | undefined {
    return this._element;
  }
  set element(v: HTMLElement) {
    this.attach(v);
  }

  constructor(config: Partial<MoverConfig>) {
    for (const key in config) {
      (this as any)[key] = config[key as ConfigKey];
    }
  }

  private _element: HTMLElement | undefined;
  private moveControl: HTMLElement | undefined;
  private beginAnchor: HTMLElement | undefined;
  private endAnchor: HTMLElement | undefined;
  private _detach: (() => void) | undefined;

  attach(element: HTMLElement): () => void {
    if (!element.parentElement) {
      throw "Mover cannot attach to an element without parentElement";
    }
    if (getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }
    element.style.boxSizing = "border-box";

    const moveControl = document.createElement("div");
    moveControl.style.display = "none";
    moveControl.style.pointerEvents = "none";
    moveControl.style.border = "0";
    moveControl.style.margin = "0";
    moveControl.style.padding = "0";
    moveControl.style.opacity = "0";
    moveControl.style.position = "absolute";
    moveControl.style.top = "0";
    moveControl.style.right = "0";
    moveControl.style.bottom = "0";
    moveControl.style.left = "0";
    moveControl.style.width = "100%";
    moveControl.style.height = "100%";
    moveControl.style.zIndex = this.zIndex.toString();
    element.appendChild(moveControl);

    const beginAnchor = document.createElement("div");
    beginAnchor.style.pointerEvents = "none";
    beginAnchor.style.border = "0";
    beginAnchor.style.margin = "0";
    beginAnchor.style.padding = "0";
    beginAnchor.style.visibility = "hidden";
    beginAnchor.style.position = "absolute";
    beginAnchor.style.top = "0";
    beginAnchor.style.left = "0";
    beginAnchor.style.bottom = "";
    beginAnchor.style.right = "";
    beginAnchor.style.width = "0";
    beginAnchor.style.height = "0";
    beginAnchor.style.zIndex = "-2147483647";
    element.parentElement.appendChild(beginAnchor);

    const endAnchor = document.createElement("div");
    endAnchor.style.pointerEvents = "none";
    endAnchor.style.border = "0";
    endAnchor.style.margin = "0";
    endAnchor.style.padding = "0";
    endAnchor.style.position = "absolute";
    endAnchor.style.top = "";
    endAnchor.style.left = "";
    endAnchor.style.bottom = "0";
    endAnchor.style.right = "0";
    endAnchor.style.width = "0";
    endAnchor.style.height = "0";
    beginAnchor.style.zIndex = "-2147483647";
    element.parentElement.appendChild(endAnchor);

    const listener = (event: PointerEvent) => {
      this.onPointerEvent(event);
    };

    for (const type of POINTER_EVENT_TYPES) {
      moveControl.addEventListener(type, listener as any);
    }

    this._element = element;
    this._detach = () => {
      try {
        element.removeChild(endAnchor);
        element.parentElement?.removeChild(beginAnchor);
        element.parentElement?.removeChild(moveControl);
      } catch (_e) { }
    };

    this.moveControl = moveControl;
    this.beginAnchor = beginAnchor;
    this.endAnchor = endAnchor;

    this.updateMoveControl();

    return () => { this.detach() };
  }

  detach() {
    if (this._detach) {
      this._detach();
      this._detach = undefined;
    }
    this._element = undefined;
    this.moveControl = undefined;
    this.beginAnchor = undefined;
    this.endAnchor = undefined;
  }

  updateMoveControl() {
    if (!this.moveControl) {
      return;
    }
    if (this._movable) {
      this.moveControl.style.display = "block";
      this.moveControl.style.pointerEvents = "auto";
      this.moveControl.style.cursor = this.moving ? "grabbing" : "grab";
    } else {
      this.moveControl.style.display = "none";
      this.moveControl.style.pointerEvents = "none";
      this.moveControl.style.cursor = "auto";
    }
  }

  private moving: boolean = false;
  private initialX: number = NaN;
  private initialY: number = NaN;
  private initialLeft: number = NaN;
  private initialTop: number = NaN;
  private initialRight: number = NaN;
  private initialBottom: number = NaN;
  private lastDisplacement: Point2D = { x: 0, y: 0 };

  onPointerEvent(event: PointerEvent) {
    if (
      !this._element ||
      !this.movable ||
      !this.moveControl ||
      !this.beginAnchor ||
      !this.endAnchor ||
      !event.isPrimary ||
      event.target !== this.moveControl
    ) {
      return;
    }
    const pointerPosition = transformFromScreenCoordinates(
      this._element,
      event.screenX,
      event.screenY,
    );
    const left = this._element.offsetLeft - this.beginAnchor.offsetLeft;
    const top = this._element.offsetTop - this.beginAnchor.offsetTop;
    const right = this.endAnchor.offsetLeft - this._element.offsetLeft - this._element.offsetWidth;
    const bottom = this.endAnchor.offsetTop - this._element.offsetTop - this._element.offsetHeight;
    switch (event.type) {
      case "pointerdown": {
        // Remove right and bottom anchors.
        const computedStyle = getComputedStyle(this._element);
        const width = computedStyle.width;
        const height = computedStyle.height;
        const currentTop = computedStyle.top;
        const currentLeft = computedStyle.left;
        this._element.style.right = "";
        this._element.style.bottom = "";
        this._element.style.top = currentTop;
        this._element.style.left = currentLeft;
        // Fix width and height.
        this._element.style.width = width;
        this._element.style.height = height;

        this.initialX = pointerPosition.x;
        this.initialY = pointerPosition.y;
        this.initialLeft = left;
        this.initialTop = top;
        this.initialRight = right;
        this.initialBottom = bottom;
        this.lastDisplacement = { x: 0, y: 0 };
        this.moveControl.setPointerCapture(event.pointerId)
        this.moving = true;
        this.updateMoveControl();
        event.preventDefault();
        event.stopPropagation();
        this._element.dispatchEvent(new MoveEvent("movestart", {
          mover: this,
          initialX: this.initialX,
          initialY: this.initialY,
          displacementX: 0,
          displacementY: 0,
        }))
        break;
      }
      case "pointerup": {
        if (this.moving) {
          this.moveControl.releasePointerCapture(event.pointerId)
          this.moving = false;
          this.updateMoveControl();
          event.preventDefault();
          event.stopPropagation();
          this._element.dispatchEvent(new MoveEvent("moveend", {
            mover: this,
            initialX: this.initialX,
            initialY: this.initialY,
            displacementX: this.lastDisplacement.x,
            displacementY: this.lastDisplacement.y,
          }))
        }
        break;
      }
      case "pointercancel": {
        if (this.moving) {
          this._element.style.top = `${this.initialTop}px`;
          this._element.style.left = `${this.initialLeft}px`;
          this.moveControl.releasePointerCapture(event.pointerId)
          this.moving = false;
          this.updateMoveControl();
          event.preventDefault();
          event.stopPropagation();
          this._element.dispatchEvent(new MoveEvent("movecancel", {
            mover: this,
            initialX: this.initialX,
            initialY: this.initialY,
            displacementX: this.lastDisplacement.x,
            displacementY: this.lastDisplacement.y,
          }))
        }
        break;
      }
      case "pointermove": {
        if (this.moving) {
          const displacement = {
            x: pointerPosition.x - this.initialX,
            y: pointerPosition.y - this.initialY,
          };
          let targetRight = Math.max(this.initialRight - displacement.x, this.marginRight);
          let targetBottom = Math.max(this.initialBottom - displacement.y, this.marginBottom);
          displacement.x = this.initialRight - targetRight;
          displacement.y = this.initialBottom - targetBottom;

          let targetLeft = Math.max(this.initialLeft + displacement.x, this.marginLeft);
          let targetTop = Math.max(this.initialTop + displacement.y, this.marginTop);
          displacement.x = targetLeft - this.initialLeft;
          displacement.y = targetTop - this.initialTop;

          this._element.style.top = `${targetTop}px`;
          this._element.style.left = `${targetLeft}px`;
          this.lastDisplacement = displacement;

          event.preventDefault();
          event.stopPropagation();

          this._element.dispatchEvent(new MoveEvent("move", {
            mover: this,
            initialX: this.initialX,
            initialY: this.initialY,
            displacementX: displacement.x,
            displacementY: displacement.y,
          }))
        }
        break;
      }
    }
  }
}

