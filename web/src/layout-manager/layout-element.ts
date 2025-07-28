import { css, html, LitElement } from "lit";
import { property } from "lit/decorators/property.js";
import { state } from "lit/decorators/state.js";
import { Mover } from "../modifiers/mover";
import { Resizer } from "../modifiers/resizer";
import { AbsoluteLayoutLength, DynamicLayoutInterval, DynamicLayoutLength, Interval, LayoutInterval, LayoutRegion } from "./layout-region";
import { ref } from "lit/directives/ref.js";

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
  region: LayoutRegion = new LayoutRegion([undefined, undefined, undefined]);

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

  @state()
  context?: HTMLElement | null;

  constructor() {
    super();
    this._mover = new Mover();
    this._resizer = new Resizer();
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

      #container {
        position: absolute;
        background: inherit;
      }

      .control {
        position: absolute;
        user-select: none;
        outline: none;
        tab-index: -1;
        width: 100%;
        height: 100%;
        opacity: 0;
        z-index: 2147483647;
      }

    `;
  }

  @state()
  private container: HTMLDivElement | undefined;

  @state()
  private centerControl?: HTMLDivElement;

  @state()
  private topControl?: HTMLDivElement;

  @state()
  private topRightControl?: HTMLDivElement;

  @state()
  private rightControl?: HTMLDivElement;

  @state()
  private bottomRightControl?: HTMLDivElement;

  @state()
  private bottomControl?: HTMLDivElement;

  @state()
  private bottomLeftControl?: HTMLDivElement;

  @state()
  private leftControl?: HTMLDivElement;

  @state()
  private topLeftControl?: HTMLDivElement;

  render() {
    const layoutActual = this.region.actual;
    const { start: left, end: _right, length: width } = layoutActual[0];
    const { start: top, end: _bottom, length: height } = layoutActual[1];
    const style =
      `left: ${left}px; width:${width}px; top: ${top}px; height: ${height};`;

    return html`
      <div id="container" part="container"
        style=${style}
        @contextmenu=${this.onContextMenu}
        ${ref(e => { this.container = e as any; })}
      >
        <slot></slot>

        <div id="center-control" class="control"
          ${ref(e => { this.centerControl = e as any; })}
        >
        </div>
        <div id="top-control" class="control"
          ${ref(e => { this.topControl = e as any; })}
        >
        </div>
        <div id="right-control" class="control"
          ${ref(e => { this.rightControl = e as any; })}
        >
        </div>
        <div id="bottom-control" class="control"
          ${ref(e => { this.bottomControl = e as any; })}
        >
        </div>
        <div id="left-control" class="control"
          ${ref(e => { this.leftControl = e as any; })}
        >
        </div>
        <div id="top-right-control" class="control"
          ${ref(e => { this.topRightControl = e as any; })}
        >
        </div>
        <div id="bottom-right-control" class="control"
          ${ref(e => { this.bottomRightControl = e as any; })}
        >
        </div>
        <div id="bottom-left-control" class="control"
          ${ref(e => { this.bottomLeftControl = e as any; })}
        >
        </div>
        <div id="top-left-control" class="control"
          ${ref(e => { this.topLeftControl = e as any; })}
        >
        </div>
      </div>
    `;
  }

  updated() {
  }

  private onContextMenu = (event: PointerEvent) => {
    console.log(`contextmenu:`, event);
  }

}

export function getElementLayoutRegion(element: HTMLElement) {
  const x = new DynamicLayoutInterval({
    start: new DynamicLayoutLength(() => element.offsetLeft),
    length: new DynamicLayoutLength(() => element.offsetWidth),
  });
  const y = new DynamicLayoutInterval({
    start: new DynamicLayoutLength(() => element.offsetTop),
    length: new DynamicLayoutLength(() => element.offsetHeight),
  });
  const z = new DynamicLayoutInterval({
    start: new DynamicLayoutLength(() => {
      const style = getComputedStyle(element);
      const zIndex = Number.parseFloat(style.zIndex);
      if (Number.isNaN(zIndex)) {
        return 0;
      }
      return zIndex;
    }),
    length: new AbsoluteLayoutLength(0),
  })
  return new LayoutRegion([x, y, z]);
}
