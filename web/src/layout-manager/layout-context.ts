import { css, html, LitElement } from "lit";
import { ref } from "lit/directives/ref.js";
import { LayoutRegion, makeLayoutInterval } from "./layout-region";

export function getElementLayout(element: HTMLElement) {
  const x = () => {
    return {
      start: element.offsetLeft,
      length: element.offsetWidth,
    };
  }
  const y = () => {
    return {
      start: element.offsetTop,
      length: element.offsetHeight,
    };
  }
  return new LayoutRegion([x, y].map(makeLayoutInterval));
}

export type RelativeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class LayoutContext extends LitElement {
  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link LayoutContext} as a custom web component with tag
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
  static register(tagName: string = "layout-context"): string {
    if (!LayoutContext.tagName) {
      customElements.define(tagName, LayoutContext);
      LayoutContext.tagName = tagName;
    }
    return LayoutContext.tagName;
  }

  static get styles() {
    return css`
      *,
      *::before,
      *::after {
        box-sizing: border-box;
        border: 0;
        margin: 0;
        padding: 0;
      }

      :host {
        --srem: 1rem;
      }

      #container {
        all: inherit;
        position: relative;
        width: 100%;
        height: 100%;
      }
    `;
  }

  private _container?: HTMLDivElement

  render() {
    const onContainerRendered = (e?: Element) => {
      this._container = e as HTMLDivElement;
    }
    return html`
      <div id="container" part="container"
        ${ref(onContainerRendered)}
      >
        <slot></slot>
      </div>
    `
  }

  getRelativeRect(element: HTMLElement): RelativeRect {
    const { offsetLeft, offsetWidth, offsetTop, offsetHeight } = element;
    const { offsetWidth: contextWidth, offsetHeight: contextHeight } =
      this._container ?? this;

    return {
      left: offsetLeft / contextWidth,
      width: offsetWidth / contextWidth,
      top: offsetTop / contextHeight,
      height: offsetHeight / contextHeight,
    };
  }

  makeRelativeLayoutRegion(relativeRect: RelativeRect) {
    const { left, width, top, height } = relativeRect;
    const x = () => {
      const { offsetWidth } = this._container ?? this;
      return {
        start: offsetWidth * left,
        length: offsetWidth * width,
      };
    }
    const y = () => {
      const { offsetHeight } = this._container ?? this;
      return {
        start: offsetHeight * top,
        length: offsetHeight * height,
      }
    }
    return new LayoutRegion([x, y].map(makeLayoutInterval));
  }

  getRelativeElementLayout(element: HTMLElement) {
    return this.makeRelativeLayoutRegion(this.getRelativeRect(element));
  }
}
