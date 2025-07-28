import { css, html, LitElement } from "lit";
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
  const z = () => {
    const style = getComputedStyle(element);
    const zIndex = Number.parseFloat(style.zIndex);
    if (Number.isNaN(zIndex)) {
      return {
      };
    }
    return {
      start: zIndex,
      end: zIndex,
    };
  }
  return new LayoutRegion([x, y, z].map(makeLayoutInterval));
}

export class LayoutContext extends LitElement {
  static get styles() {
    return css`
      #container {
        position: relative;
        display: flex;
      }
    `;
  }

  render() {
    return html`
      <div id="container" part="container">
        <slot></slot>
      </div>
    `
  }

}
