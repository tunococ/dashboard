export type EditableImageProperties = {
  src: string;
  alt: string;
  linkTo: string;
}

export class EditableImage extends HTMLElement {
  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link EditableImage} as a custom web component with tag
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
  static register(tagName: string = "editable-image"): string {
    if (!EditableImage.tagName) {
      customElements.define(tagName, EditableImage);
      EditableImage.tagName = tagName;
      return tagName;
    } else {
      return EditableImage.tagName;
    }
  }

  container: HTMLDivElement;
  img: HTMLImageElement;
  src: string = "";
  alt: string = "";
  linkTo: string = "";

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
          pointer-events: auto;
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        #image {
          display: none;
          flex: 1;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        #url-form {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        #choose-image-dialog {
          pointer-events: auto;
          box-shadow: 5px 5px 5px grey;
          border: 0;
          padding: 0;
        }

        .vertical-flex {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        #choose-image-dialog-title {
          background-color: var(--dialog-title-background-color, blue);
          color: white;
          line-height: 2;
          text-align: center;
          font-family: sans-serif;
          font-size: 1.2em;
          margin: 0;
          width: 100%;
        }

        #choose-image-button {
          width: 100%;
          flex: 1;
        }
      
        #preview {
          display: none;
        }
      </style>
      <map name="image-map">
        <area id="image-link" shape="default" target="_blank" />
      </map>
      <div id="container">
        <img id="image"
          part="img" 
          usemap="#image-map"
        >
        <button id="choose-image-button">Click to choose an image </button>
      </div>
      <dialog id="choose-image-dialog"
        closeby="any"
        part="choose-image-dialog"
      >
        <div class="vertical-flex">
          <div id="choose-image-dialog-title">
            Choose an image
          </div>
          <div class="vertical-flex" style="margin: 1em">
            <div>
              <label for="url">You can enter a url: </label>
              <input id="url" type="url" name="url" />
            </div>
            <div><br></div>
            <div>
              Or you can
              <label id="upload-button"
                for="upload"
                part="upload-button"
                class="input-button"
              >upload an image</label>
              <input type="file" id="upload" name="upload" hidden />
            </div>
            <div><br></div>
            <div id="preview">
              Preview:
              <img id="preview-image" />
              <div><br></div>
            </div>
            <div style="position: relative; width: 100%;">
              <button id="cancel-button">Cancel</button>
              <button id="accept-button"
                style="position: absolute; right: 0"
              >Accept</button>
            </div>
          </div>
        </div>
      </dialog>
      <dialog id="enter-url-dialog" closeby="any" part="dialog">
        <form id="url-form" method="dialog">
          <label for="url">Image URL</label>
          <input type="url" name="url" id="url-input" />
          <div>
          <button id="submit-url">OK</button>
          <button id="close-url-dialog">Cancel</button>
          </div>
        </form>
      </dialog>
    `;

    const root = this.attachShadow({ mode: "open" })
    root.append(template.content.cloneNode(true));

    this.img = root.getElementById("image") as HTMLImageElement

    this.container = root.getElementById("container") as HTMLDivElement;

    const chooseImageDialog = root.getElementById("choose-image-dialog") as HTMLDialogElement;

    const chooseImageButton = root.getElementById("choose-image-button") as HTMLButtonElement;
    chooseImageButton.addEventListener("click", (e: MouseEvent) => {
      if (e.target !== chooseImageButton) {
        return;
      }
      e.stopPropagation();
      chooseImageDialog.showModal();
    })

    chooseImageDialog.addEventListener("click", (e: MouseEvent) => {
      if (e.target !== chooseImageDialog) {
        return;
      }
      e.stopPropagation();
      chooseImageDialog.close();
    });

    const previewImage = root.getElementById("preview-image") as HTMLImageElement;

    const uploadButton = root.getElementById("upload-button") as HTMLLabelElement;
    uploadButton.addEventListener("click", (e: MouseEvent) => {
      if (e.target !== uploadButton) {
        return;
      }
      e.stopPropagation();
      this.loadPreview();
    })

    const cancelButton = root.getElementById("cancel-button") as HTMLButtonElement;
    cancelButton.addEventListener("click", () => {
      chooseImageDialog.close();
    })
    const acceptButton = root.getElementById("accept-button") as HTMLButtonElement;
    acceptButton.addEventListener("click", () => {

    })

    const preview = root.getElementById("preview") as HTMLDivElement;


  }

  loadPreview() {
  }

};

