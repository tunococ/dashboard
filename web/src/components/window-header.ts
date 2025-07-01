import { LitElement, css, html } from "lit";
import { property } from "lit/decorators.js";

export class WindowHeader extends LitElement {
  // Extend the native HTMLDialogElement
  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link AssetLibrary} as a custom web component with tag
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
  static register(tagName: string = "window-header"): string {
    if (!WindowHeader.tagName) {
      customElements.define(tagName, WindowHeader);
      WindowHeader.tagName = tagName;
    }
    return WindowHeader.tagName;
  }

  static get styles() {
    return css`
      :host {
        border: 0;
        padding: 0;
        box-sizing: border-box;
        --srem: 1rem;
      }

      #container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        height: 100%;
      }

      #header {
        user-select: none;
        background: var(
          --window-header-background,
          linear-gradient(155deg,
            #0000ff, #1f2fef 60%, 80%, #5f9f5f, 90%, #2f3fbf
          )
        );
        display: flex;
        flex-direction: row;
        align-content: center;
        align-items: center;
      }

      #header-text {
        position: relative;
        color: var(--window-header-text-color, #efefef);
        font-family: var(--window-header-font-family, sans-serif);
        font-size: var(--window-header-font-size, calc(1.2 * var(--srem)));
        text-align: var(--window-header-text-align, center);
        line-height: 1.2;
        width: 100%;
        margin: 0;
        padding: 0;
      }

      #close-button {
        background-color: transparent;
        color: var(--window-header-text-color, #efefef);
        border: none;
        position: absolute;
        right: calc(0.2 * var(--srem));
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
      }

      #content {
        flex: 1;
        width: 100%;
        min-height: 0;
      }

    `;
  }

  @property()
  text: string = "";

  render() {
    const onClickCloseButton = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.dispatchEvent(new Event("close"));
    };
    return html`
      <div id="container">
        <div id="header">
          <div id="header-text">
            ${this.text}
          </div>
          <div id="close-button"
            @click=${onClickCloseButton}
          >
            ${htmlCloseIcon()}
          </div>
        </div>
        <div id="content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

const svgNS = "http://www.w3.org/2000/svg";

function htmlCloseIcon(
  options: {
    stroke?: string;
    strokeWidth?: string;
  } = {},
) {
  const stroke = options.stroke ?? "currentColor";
  const strokeWidth = options.strokeWidth ?? "15";
  return html`
    <svg xmlns=${svgNS}
      viewBox="0 0 100 100"
      width="0.8lh"
    >
      <line stroke=${stroke} stroke-width=${strokeWidth}
        x1=0 y1=0 x2=100 y2=100
      />
      <line stroke=${stroke} stroke-width=${strokeWidth}
        x1=100 y1=0 x2=0 y2=100
      />
    </svg>
  `;
}
