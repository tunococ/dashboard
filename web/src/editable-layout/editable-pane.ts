import { LitElement, css, html } from "lit";
import { property } from "lit/decorators/property.js";

type Length = {
  unit: "px" | "%";
  value: number;
  base?: Interval;
};

type Interval =
  | {
      start: Length;
      end: Length;
      length?: Length;
    }
  | {
      start: Length;
      end?: Length;
      length: Length;
    }
  | {
      start?: Length;
      end: Length;
      length: Length;
    };

function setLengthProperty(
  element: HTMLElement,
  name: string,
  value?: Length | null,
) {
  if (value == null) {
    element.style.removeProperty(name);
    return false;
  }
  element.style.setProperty(name, `${value.value}${value.unit}`);
  return true;
}

export class PaneElement {
  htmlElement: HTMLElement;
  leftAnchor?: Length;
  rightAnchor?: Length;
  topAnchor?: Length;
  bottomAnchor?: Length;
  width?: Length;
  height?: Length;

  constructor(htmlElement: HTMLElement) {
    this.htmlElement = htmlElement;
  }

  updatePosition() {
    setLengthProperty(this.htmlElement, "width", this.width);
  }
}

export class EditablePane extends LitElement {
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
  static register(tagName: string = "editable-pane"): string {
    if (!EditablePane.tagName) {
      customElements.define(tagName, EditablePane);
      EditablePane.tagName = tagName;
    }
    return EditablePane.tagName;
  }

  @property({ type: Array })
  members: HTMLElement[] = [];

  static get styles() {
    return css`
      #container {
        width: 100%;
        height: 100%;
        position: relative;
      }
    `;
  }

  render() {
    return html`
    `;
  }
}
