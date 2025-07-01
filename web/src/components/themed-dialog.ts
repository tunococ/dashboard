export class ThemedDialog extends HTMLDialogElement { // Extend the native HTMLDialogElement
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
  static register(tagName: string = "themed-dialog"): string {
    if (!ThemedDialog.tagName) {
      customElements.define(tagName, ThemedDialog, { extends: "dialog" });
      ThemedDialog.tagName = tagName;
      return tagName;
    } else {
      return ThemedDialog.tagName;
    }
  }

  constructor() {
    super(); // Always call super() in the constructor when extending
  }

  makeTitleText = () => {
    const titleText = document.createElement("div");
    titleText.style.position = "relative";
    titleText.style.color = "var(--themed-dialog-title-color, #efefef)";
    titleText.style.fontFamily = "var(--themed-dialog-title-font-family, sans-serif)";
    titleText.style.fontSize = "var(--themed-dialog-title-font-size, 1.2em)";
    titleText.style.textAlign = "var(--themed-dialog-title-text-align, center)";
    titleText.style.lineHeight = "1.2";
    titleText.style.width = "100%";
    titleText.style.margin = "0";
    titleText.style.padding = "0";
    titleText.textContent = this.dataset.title ?? "Title";
    return titleText;
  }

  makeCloseDialogIcon = () => {
    const closeIcon = closeWindowIcon();
    closeIcon.setAttribute("width", "0.6lh");
    closeIcon.setAttribute("height", "0.6lh");
    return closeIcon;
  }

  makeCloseDialogButton = () => {
    const closeButton = document.createElement("div");
    closeButton.style.cssText = `
      background-color: transparent;
      color: var(--themed-dialog-title-color, #efefef);
      border: none;
      position: absolute;
      right: 0.2lh;
      top: 0;
      align-self: start;
      justify-self: start;
      cursor: pointer;
    `;
    closeButton.append(this.makeCloseDialogIcon());
    closeButton.addEventListener("click", () => {
      this.close();
    });
    return closeButton;
  };

  makeTitle = () => {
    const title = document.createElement("div");
    title.style.cssText = `
      background: var(
        --themed-dialog-title-background,
        linear-gradient(155deg, #0000ff, #1f2fef 60%, 80%, #5f9f5f, 90%, #2f3fbf)
      );
      display: flex;
      justify-content: space-between;
    `;
    title.append(this.makeTitleText(), this.makeCloseDialogButton());
    return title;
  }

  makeContainer = (children: Iterable<Node> = []) => {
    const container = document.createElement("div");
    container.style.position = "relative";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "stretch";
    container.style.width = "100%";
    container.style.height = "100%";

    const content = document.createElement("div");
    content.style.flex = "1";
    content.style.minHeight = "0";
    content.append(...children);

    container.append(this.makeTitle(), content);
    return container;
  }

  private childrenMoved: boolean = false;

  connectedCallback() {
    console.log(`XXX themedDialog with title ${this.dataset.title} connectedCallback`)
    if (this.childrenMoved) {
      return;
    }
    const children = this.childNodes;
    for (const child of children) {
      this.removeChild(child);
    }
    this.append(this.makeContainer(children));
    this.childrenMoved = true;
  }
}

const svgNS = "http://www.w3.org/2000/svg";

function closeWindowIcon(options: {
  stroke?: string;
  strokeWidth?: string;
} = {}) {
  // Create the SVG element
  let svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");

  const stroke = options.stroke ?? "currentColor";
  const strokeWidth = options.strokeWidth ?? "15";

  // Create the first line
  let line1 = document.createElementNS(svgNS, "line");
  line1.setAttribute("x1", "0");
  line1.setAttribute("y1", "0");
  line1.setAttribute("x2", "100");
  line1.setAttribute("y2", "100");
  line1.setAttribute("stroke", stroke);
  line1.setAttribute("stroke-width", strokeWidth);

  // Create the second line
  let line2 = document.createElementNS(svgNS, "line");
  line2.setAttribute("x1", "100");
  line2.setAttribute("y1", "0");
  line2.setAttribute("x2", "0");
  line2.setAttribute("y2", "100");
  line2.setAttribute("stroke", stroke);
  line2.setAttribute("stroke-width", strokeWidth);

  // Append the lines to the SVG
  svg.appendChild(line1);
  svg.appendChild(line2);

  return svg;
}

