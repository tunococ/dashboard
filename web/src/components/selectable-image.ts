export class SelectableImage extends HTMLElement {
  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link SelectableImage} as a custom web component with tag
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
  static register(tagName: string = "selectable-image"): string {
    if (!SelectableImage.tagName) {
      customElements.define(tagName, SelectableImage);
      SelectableImage.tagName = tagName;
      return tagName;
    } else {
      return SelectableImage.tagName;
    }
  }

  container: HTMLDivElement;
  image: HTMLImageElement;
  imageUrl: string = "";

  constructor() {
    super();

    const template = document.createElement("template");
    template.innerHTML = `
      <style>
        :host {
          all: inherit;
        }

        * {
          pointer-events: auto;
        }

        .input-button {
          display: block;
          width: fit-content;
          text-align: center;
          background-color: #ccc;
          color: #000;
          border: 0.05em solid #000;
          border-radius: 0.25em;
          padding: 0.25em;
        }

        .input-button:hover {
          background-color: #aaa;
        }
      
        .input-button:active {
          background-color: #888;
          color: #fff;
          border-color: #fff;
        }
      
        #container {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        #image {
          flex: 1;
        }
      </style>
      <div id="container">
        <label for="pick-file" id="pick-file-button" part="pick-file-button" class="input-button">Choose an image file</label>
        <input type="file" id="pick-file" name="pick-file" hidden />
        <label id="enter-url" part="enter-url-button" class="input-button">Enter an image URL</label>
        <img id="image">
      </div>
      <dialog id="enter-url-dialog">
      </dialog>
    `;

    const root = this.attachShadow({ mode: "open" })
    root.append(template.content.cloneNode(true));

    this.image = root.getElementById("image") as HTMLImageElement
    this.container = root.getElementById("container") as HTMLDivElement;

    const pickFileInput = root.getElementById("pick-file") as HTMLInputElement
    pickFileInput.addEventListener("change", () => {
      console.log(`picked file: ${pickFileInput.value}`);
    })

    const pickFileButton = root.getElementById("pick-file-button") as HTMLLabelElement;
    pickFileButton.addEventListener("click", (e: MouseEvent) => {
      if (e.target === pickFileButton) {
        e.stopPropagation();
      }
    })
    pickFileButton.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.target === pickFileButton) {
        e.stopPropagation();
      }
    })

    const enterUrlDialog = root.getElementById("enter-url-dialog") as HTMLDialogElement;

    const enterUrlButton = root.getElementById("enter-url") as HTMLLabelElement;
    enterUrlButton.addEventListener("click", (e: MouseEvent) => {
      if (e.target === enterUrlButton) {
        e.stopPropagation();
        enterUrlDialog.showModal();
      }
    })
    enterUrlButton.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.target === enterUrlButton) {
        e.stopPropagation();
      }
    })
  }
};

