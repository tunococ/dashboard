import { css, html, LitElement } from "lit";
import { property } from "lit/decorators/property.js";
import { Interval, LayoutInterval, LayoutRegion } from "./layout-region";
import { ref } from "lit/directives/ref.js";
import { getElementLayout, LayoutContext } from "./layout-context";
import { findAncestorOfType } from "../browser-utils/dom";

export class LayoutControlEvent extends Event {
  touchEvent: PointerEvent;
  index: number;
  constructor(index: number, touchEvent: PointerEvent) {
    super("layoutcontrol");
    this.index = index;
    this.touchEvent = touchEvent;
  }
}

export class LayoutElementEvent extends Event {
  innerEvent?: Event;
  constructor(type: string, innerEvent?: Event) {
    super(type, { bubbles: false });
    this.innerEvent = innerEvent;
  }
}

export class LayoutElement extends LitElement {
  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link LayoutElement} as a custom web component with tag
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
  static register(tagName: string = "layout-element"): string {
    if (!LayoutElement.tagName) {
      customElements.define(tagName, LayoutElement);
      LayoutElement.tagName = tagName;
    }
    return LayoutElement.tagName;
  }

  @property()
  region: LayoutRegion = new
    LayoutRegion([undefined, undefined, undefined]);

  savedRegion: LayoutRegion = new LayoutRegion(
    [undefined, undefined, undefined]
  );

  saveRegion(newRegion?: LayoutRegion) {
    if (!newRegion) {
      this.savedRegion = getElementLayout(this);
    }
  }

  loadRegion() {
    this.region = structuredClone(this.savedRegion);
  }

  useRelativeLayout() {
    if (!this.context) {
      return;
    }
  }

  @property()
  get x(): LayoutInterval | undefined {
    return this.region.axis[0];
  }
  set x(x: LayoutInterval | (() => Interval)) {
    if (typeof x === "function") {
      this.region.axis[0] = { get actual() { return x(); } };
    } else {
      this.region.axis[0] = x;
    }
    this.requestUpdate();
  }

  @property()
  get y(): LayoutInterval | undefined {
    return this.region.axis[1];
  }
  set y(y: LayoutInterval | (() => Interval)) {
    if (typeof y === "function") {
      this.region.axis[1] = { get actual() { return y(); } };
    } else {
      this.region.axis[1] = y;
    }
    this.requestUpdate();
  }

  @property()
  get z(): LayoutInterval | undefined {
    return this.region.axis[2];
  }
  set z(z: LayoutInterval | (() => Interval)) {
    if (typeof z === "function") {
      this.region.axis[2] = { get actual() { return z(); } };
    } else {
      this.region.axis[2] = z;
    }
    this.requestUpdate();
  }

  get context(): LayoutContext | null | undefined {
    return this._context;
  }

  set context(c: LayoutContext | null | undefined) {
    if (c !== this._context && c instanceof LayoutContext) {
      this._clearContextListener();
      this._context = c;
      const listener = () => {
        this.requestUpdate();
      };
      c.addEventListener("layoutchanged", listener);
      this._clearContextListener = () => {
        c.removeEventListener("layoutchanged", listener);
      }
    }
  }

  _context?: LayoutContext | null;
  _clearContextListener: () => void = () => { };

  constructor() {
    super();
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
        position: absolute;
      }

      #container {
        width: 100%;
        height: 100%;
      }

      .control {
        position: absolute;
        user-select: none;
        pointer-events: none;
        outline: none;
        tab-index: -1;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2147483647;
        opacity: 0;
      }

      .control.center-control {
        border-style: solid;
        overflow: hidden;
        animation: 4s ease-in-out infinite dynamic-border-color;
        background-color: transparent;
        border-width: calc(0.3 * var(--srem));
      }

      @keyframes dynamic-border-color {
        0% {
          border-color: #ffffff;
        }
        6.25% {
          border-color: #ffffff80;
        }
        12.5% {
          border-color: #000080;
        }
        18.75% {
          border-color: #ffffc080;
        }
        25% {
          border-color: #ffffc0;
        }
        31.25% {
          border-color: #ffffc080;
        }
        37.5% {
          border-color: #800000;
        }
        43.75% {
          border-color: #c0ffff80;
        }
        50% {
          border-color: #c0ffff;
        }
        56.25% {
          border-color: #c0ffff80;
        }
        62.5% {
          border-color: #008000;
        }
        68.75% {
          border-color: #ffc0ff80;
        }
        75% {
          border-color: #ffc0ff;
        }
        81.25% {
          border-color: #ffc0ff80;
        }
        87.5% {
          border-color: #000000;
        }
        92.75% {
          border-color: #ffffff80;
        }
        100% {
          border-color: #ffffff;
        }
      }

      .control.top-control {
        top: 0;
        height: calc(0.3 * var(--srem));
      }

      .control.bottom-control {
        top: unset;
        bottom: 0;
        height: calc(0.3 * var(--srem));
      }

      .control.left-control {
        left: 0;
        width: calc(0.3 * var(--srem));
      }

      .control.right-control {
        left: unset;
        right: 0;
        width: calc(0.3 * var(--srem));
      }
    `;
  }

  private container: HTMLDivElement | undefined;

  private controls: (HTMLDivElement | undefined)[] = Array(9).fill(undefined);

  /*
   * This function tries to find the closest LayoutContext by going up the DOM
   * tree from offsetParent.
   */
  findContext() {
    const context = findAncestorOfType(this, LayoutContext);
    this.context = context;
  }

  initializeContainer(container?: HTMLDivElement) {
    this.container = container;
    this.findContext();
  }

  render() {
    const onControlEvent = (event: PointerEvent) => {
      this.onControlEvent(event);
    }

    const controls = [
      ["center-control", "center-control"],
      ["top-control", "top-control"],
      ["right-control", "right-control"],
      ["bottom-control", "bottom-control"],
      ["left-control", "left-control"],
      ["top-left-control", "top-control left-control"],
      ["top-right-control", "top-control right-control"],
      ["bottom-right-control", "bottom-control right-control"],
      ["bottom-left-control", "bottom-control left-control"],
    ].map((params, index) => {
      const [id, classes] = params;
      const onRef = (e: any) => { this.controls[index] = e as any; };
      return html`
        <div id=${id} class="control ${classes}"
          ${ref(onRef)}
          @pointermove=${onControlEvent}
          @pointerover=${onControlEvent}
          @pointerenter=${onControlEvent}
          @pointerleave=${onControlEvent}
          @pointerout=${onControlEvent}
          @pointercancel=${onControlEvent}
          @pointerdown=${onControlEvent}
          @pointerup=${onControlEvent}
          @gotpointercapture=${onControlEvent}
          @lostpointercapture=${onControlEvent}
        >
      `;
    });

    return html`
      <div id="container" part="container"
        @contextmenu=${this.onContextMenu}
        ${ref(e => { this.initializeContainer(e as any); })}
      >
        <slot></slot>
        ${controls}

      </div>
    `;

  }

  updated() {
    const region = this.region.actual;
    this.style.left = `${region[0].start}px`;
    this.style.width = `${region[0].length}px`;
    this.style.top = `${region[1].start}px`;
    this.style.height = `${region[1].length}px`;
    if (region[2]) {
      this.style.zIndex = `${region[2].start}`;
    } else {
      this.style.zIndex = "unset";
    }
  }

  private onContextMenu = (event: PointerEvent) => {
    console.log(`contextmenu:`, event);
  }

  private _resizable: boolean = false;

  get resizable() {
    return this._resizable;
  }

  set resizable(resizable: boolean) {
    this._resizable = resizable;
    for (let i = 1; i < this.controls.length; ++i) {
      const control = this.controls[i];
      if (control) {
        if (resizable) {
          switch (i) {
            case 1:
            case 3: {
              control.style.cursor = "ns-resize";
              break;
            }
            case 2:
            case 4: {
              control.style.cursor = "ew-resize";
              break;
            }
            case 5:
            case 7: {
              control.style.cursor = "nwse-resize";
              break;
            }
            default: {
              control.style.cursor = "nesw-resize";
              break;
            }
          }
          control.style.pointerEvents = "auto";
        } else {
          control.style.cursor = "unset";
          control.style.pointerEvents = "none";
        }
      }
    }
    this.updateBorder();
  }

  private _movable: boolean = false;

  get movable() {
    return this._movable;
  }

  set movable(movable: boolean) {
    this._movable = movable;
    const control = this.controls[0];
    if (!control) {
      return;
    }
    if (movable) {
      control.style.pointerEvents = "auto";
      control.style.cursor = "grab";

    } else {
      control.style.pointerEvents = "none";
      control.style.cursor = "unset";
    }
    this.updateBorder();
  }

  private showBorder(show: boolean) {
    const control = this.controls[0];
    if (!control) {
      return;
    }
    control.style.opacity = show ? "0.5" : "0";
  }

  private updateBorder() {
    this.showBorder(this._resizable || this._movable);
  }

  keepAspectRatio: boolean = false;

  onControlEvent(event: PointerEvent) {
    const target = event.target as HTMLDivElement;
    if (!target) {
      return;
    }
    const index = this.controls.findIndex(e => e === target);
    if (index < 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.dispatchEvent(new LayoutControlEvent(index, event))
  }

}

