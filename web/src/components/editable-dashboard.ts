import "../style.css";
import daiki from "../../public/Daiki.png";
import faceland from "../../public/Faceland.png";
import fuecoco from "../../public/Fuecoco.png";
import guangdang from "../../public/Guangdang.png";
import cabbaggy from "../../public/cabbaggy.png";
import seal from "../../public/seal.png";
import sneal from "../../public/sneal.png";
import wigglytuff from "../../public/Wigglytuff.png";
import oddish from "../../public/Oddish.png";
import { MoveEvent, Mover } from "../modifiers/mover";
import { ResizeEvent, Resizer } from "../modifiers/resizer";
import { AssetLibrary, type AssetLibraryEvent } from "./asset-library";
import { WindowHeader } from "./window-header";
import { ZoomableView } from "./zoomable-view";

export class EditableDashboard extends HTMLElement {
  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link EditableDashboard} as a custom web component with tag
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
  static register(tagName: string = "editable-dashboard"): string {
    if (!EditableDashboard.tagName) {
      customElements.define(tagName, EditableDashboard);
      EditableDashboard.tagName = tagName;
    }
    return EditableDashboard.tagName;
  }

  constructor() {
    super();

    const zoomableViewTag = ZoomableView.register();
    const assetLibraryTag = AssetLibrary.register();
    const windowHeaderTag = WindowHeader.register();

    const template = document.createElement("template");
    template.innerHTML = `
      <style>
        :host {
          box-sizing: border-box;
        }

        *,
        *:after,
        *:before {
          box-sizing: inherit;
        }

        #render-area {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: auto;
        }

        #dashboard {
          position: relative;
          width: 100%;
          height: 100%;
        }

        #clock {
          color: #f80;
          font-size: 3rem;
          text-shadow: 0.05em 0.05em 0.1em #000;
          font-family: monospace;
        }

        #overlay {
          transition: opacity 0.5s ease 0s;
          opacity: 0;
        }

        #asset-library {
          width: 100%;
          height: 100%;
        }

        #asset-library-dialog {
          border: 0;
          padding: 0;
        }
      </style>
      <div id="render-area">
        <${zoomableViewTag} id="zoomable-view"
          view-margin-left="-1000vw"
          view-margin-right="-1000vw"
          view-margin-top="-1000vh"
          view-margin-bottom="-1000vh"
        >
          <div slot="background" id="background" style="position: relative; width: 100%; height: 100%;">
            <img src="${faceland}" style="display: block; width:100%; height:100%; object-fit: cover; object-position: center;" />
          </div>
          <div slot="overlay" id="overlay" style="position: relative; width: 100%; height: 100%;">
            <div style="position: absolute; bottom: 1rem; right: 1rem;">
              <button id="reset-zoom" style="pointer-events: auto">Reset zoom</button>
              <button id="zoom-to-fit" style="pointer-events: auto">Zoom to fit</button>
              <button id="toggle-fullscreen" style="pointer-events: auto"></button>
            </div>
            <div style="position: absolute; top: 1rem; right: 1rem;">
              <button id="show-assets" style="pointer-events: auto">Assets</button>
              <button id="login" style="pointer-events: auto">Log in</button>
              <button id="toggle-walkers" style="pointer-events: auto">Toggle walkers</button>
            </div>
          </div>
          <div id="dashboard" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 480px; height 200px;">
            <div style="display: flex; flex-direction: row; align-items: center; justify-content: center;">
              <img src="${wigglytuff}" width=100 />
            </div>
            <div id="clock" style="white-space:pre;">
            </div>
            <div style="display: flex; flex-direction: row; align-items: center; justify-content: center;">
              <img class="walker" src="${daiki}" width=70 />
              <img class="walker" src="${seal}" width=70 />
              <img class="walker" src="${fuecoco}" width=70 />
              <img src="${oddish}" width=80 />
              <img class="walker" src="${cabbaggy}" width=70 />
              <img class="walker" src="${guangdang}" width=70 />
              <img class="walker" src="${sneal}" width=70 />
            </div>
            <div id="resizable" style="display: none; position: absolute; pointer-events: auto; bottom: 1em; left: 1em; width: 12em; height: 6em;">
              <div id="resizable-interior" style="background-color: #ddf; overflow: scroll; width: 100%; height: 100%; border: 2px solid transparent;">
                <div style="width: 100%; height: 100%; overflow: scroll;">
                  <input type="checkbox" id="toggle-resize" name="toggle-resize"
                    />
                  <label for="toggle-resize">Resizable</label>
                  <br>
                  <input type="checkbox" id="toggle-aspect-ratio" name="toggle-aspect-ratio"
                    />
                  <label for="toggle-aspect-ratio">Maintain aspect ratio</label>
                  <br>
                  <input type="checkbox" id="toggle-move" name="toggle-move"
                    />
                  <label for="toggle-move">Movable</label>
                </div>
              </div>
            </div>
          </div>
        </${zoomableViewTag}>
        <dialog
          id="asset-library-dialog"
          data-title="Asset Library"
          style="background: none; width: 75%; height: 75%; border-radius: 0.5em; overflow: clip;"
        >
          <${windowHeaderTag} id="asset-library-header" text="Asset Library">
            <${assetLibraryTag} id="asset-library">
            </${assetLibraryTag}>
          </${windowHeaderTag}>
        </dialog>
      </div>
    `;
    const root = this.attachShadow({ mode: "open" });
    root.append(template.content.cloneNode(true));

    const renderArea = root.querySelector("#render-area");
    if (!renderArea) {
      throw "renderArea is null";
    }

    const zoomableView = root.getElementById("zoomable-view") as ZoomableView;
    if (!zoomableView) {
      throw "zoomableView is null";
    }
    zoomableView.style.color = "blue";

    // Background

    const background = root.getElementById("background");
    if (!background) {
      throw "background is null";
    }

    let hideOverlay: number | undefined = undefined;
    background.addEventListener("pointermove", () => {
      clearTimeout(hideOverlay);
      overlay.style.opacity = "1";
      hideOverlay = setTimeout(() => {
        overlay.style.opacity = "0";
      }, 5000);
    });

    // Overlay

    const overlay = root.getElementById("overlay") as HTMLDivElement;
    if (!overlay) {
      throw "overlay is null";
    }
    overlay.addEventListener("pointermove", () => {
      clearTimeout(hideOverlay);
      overlay.style.opacity = "1";
      hideOverlay = setTimeout(() => {
        overlay.style.opacity = "0";
      }, 1500);
    });

    const toggleFullscreenButton = root.getElementById("toggle-fullscreen");
    if (!toggleFullscreenButton) {
      throw "toggleFullscreenButton is null";
    }
    const updateToggleFullscreenButton = () => {
      if (root.fullscreenElement) {
        toggleFullscreenButton.textContent = "Exit fullscreen";
      } else {
        toggleFullscreenButton.textContent = "Enter fullscreen";
      }
    };
    root.addEventListener("fullscreenchange", updateToggleFullscreenButton);
    toggleFullscreenButton.addEventListener("click", (event: MouseEvent) => {
      if (event.target === toggleFullscreenButton) {
        event.preventDefault();
        event.stopPropagation();
        if (root.fullscreenElement) {
          document.exitFullscreen();
        } else {
          renderArea.requestFullscreen();
        }
        updateToggleFullscreenButton();
      }
    });
    updateToggleFullscreenButton();

    const resetZoomButton = root.getElementById("reset-zoom");
    if (!resetZoomButton) {
      throw "resetZoomButton is null";
    }
    resetZoomButton.addEventListener("click", (event: MouseEvent) => {
      if (event.target === resetZoomButton) {
        event.preventDefault();
        event.stopPropagation();
        zoomableView.setViewOffset(0, 0);
        zoomableView.setZoom(1);
      }
    });

    const zoomToFitButton = root.getElementById("zoom-to-fit");
    if (!zoomToFitButton) {
      throw "zoomToFitButton is null";
    }
    zoomToFitButton.addEventListener("click", (event: MouseEvent) => {
      if (event.target === zoomToFitButton) {
        event.preventDefault();
        event.stopPropagation();
        zoomableView.setViewOffset(0, 0);
        zoomableView.zoomToFit(true);
      }
    });

    const toggleWalkersButton = root.getElementById("toggle-walkers");
    if (!toggleWalkersButton) {
      throw "toggleWalkersButton is null";
    }
    let walkersEnabled = true;
    toggleWalkersButton.addEventListener("click", (event: MouseEvent) => {
      if (event.target === toggleWalkersButton) {
        event.preventDefault();
        event.stopPropagation();
        const walkers = root.querySelectorAll(".walker");
        walkersEnabled = !walkersEnabled;
        console.log(`XXX toggling: ${walkersEnabled}`)
        for (const walker of walkers) {
          if (walker instanceof HTMLElement) {
            console.log(`XXX toggling walker: ${walkersEnabled}`)
            walker.style.display = walkersEnabled ? "" : "none";
          }
        }
      }
    })

    const loginButton = root.getElementById("login");
    if (!loginButton) {
      throw "loginButton is null";
    }

    const showAssetsButton = root.getElementById("show-assets");
    if (!showAssetsButton) {
      throw "showAssetsButton is null";
    }
    const assetLibraryDialog = root.getElementById(
      "asset-library-dialog",
    ) as HTMLDialogElement;
    if (!assetLibraryDialog) {
      throw "assetLibraryDialog is null";
    }
    const assetLibrary = root.getElementById("asset-library") as AssetLibrary;
    if (!assetLibrary) {
      throw "assetLibrary is null";
    }
    const assetLibraryHeader = root.getElementById(
      "asset-library-header",
    ) as WindowHeader;
    if (!assetLibraryHeader) {
      throw "assetLibraryHeader is null";
    }
    showAssetsButton.addEventListener("click", (event: Event) => {
      if (event.target !== showAssetsButton) {
        return;
      }
      assetLibraryDialog.showModal();
      assetLibrary.focus();
      event.stopPropagation();
    });
    assetLibraryHeader.addEventListener("close", (event: Event) => {
      assetLibraryDialog.close();
      event.stopPropagation();
    });
    assetLibrary.addEventListener("cancel", (event: AssetLibraryEvent) => {
      assetLibraryDialog.close();
      event.preventDefault();
    });
    assetLibrary.addEventListener("ok", (event: AssetLibraryEvent) => {
      console.log(`selectedAssets:`, event.selectedAssets);
      for (const asset of event.selectedAssets) {
        console.log(`${asset.name}`);
      }
      event.preventDefault();
    });

    // Content

    setTimeout(() => zoomableView.zoomToFit(true), 0);

    const clock = root.getElementById("clock");
    {
      if (!clock) {
        throw "clock is null";
      }
      clock.textContent = " 00:00:00 MM ";
      setInterval(() => {
        const date = new Date();
        clock.textContent = ` ${date.toLocaleTimeString()} `;
      }, 20);
    }

    const resizable = root.getElementById("resizable");
    if (!resizable) {
      throw "resizable is null";
    }
    const resizableInterior = root.getElementById("resizable-interior");
    if (!resizableInterior) {
      throw "resizableInterior is null";
    }
    const resizer = new Resizer({
      resizeBorderWidth: 5,
      aspectRatioOffsetHeight: 10,
      aspectRatioOffsetWidth: 10,
      minWidth: 1,
      minHeight: 1,
    });
    resizer.attach(resizable);

    const mover = new Mover({
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      marginBottom: 0,
    });
    mover.attach(resizable);

    const updateResizableBorder = () => {
      if (resizer.resizable || mover.movable) {
        resizableInterior.style.border = "2px red dashed";
      } else {
        resizableInterior.style.border = "2px solid transparent";
      }
    };
    updateResizableBorder();

    const resizeHandler = (e: Event) => {
      if (!(e instanceof ResizeEvent)) {
        throw "Wrong event type -- expected ResizeEvent";
      }
    };
    resizable.addEventListener("resizestart", resizeHandler);
    resizable.addEventListener("resizeend", resizeHandler);
    resizable.addEventListener("resizecancel", resizeHandler);
    resizable.addEventListener("resize", resizeHandler);
    resizable.addEventListener("resized", resizeHandler);

    const toggleResizeButton = root.getElementById(
      "toggle-resize",
    ) as HTMLInputElement;
    if (!toggleResizeButton) {
      throw "toggleResizeButton is null";
    }
    toggleResizeButton.checked = resizer.resizable;
    toggleResizeButton.addEventListener("change", (e: Event) => {
      if (e.target === toggleResizeButton) {
        if (toggleResizeButton.checked) {
          resizer.resizable = true;
        } else {
          resizer.resizable = false;
        }
        updateResizableBorder();
      }
    });

    const toggleAspectRatioButton = root.getElementById(
      "toggle-aspect-ratio",
    ) as HTMLInputElement;
    if (!toggleAspectRatioButton) {
      throw "toggleAspectRatioButton is null";
    }
    toggleAspectRatioButton.checked = resizer.maintainAspectRatio;
    toggleAspectRatioButton.addEventListener("change", (e: Event) => {
      if (e.target === toggleAspectRatioButton) {
        if (toggleAspectRatioButton.checked) {
          resizer.aspectRatio =
            (resizable.offsetWidth - resizer.aspectRatioOffsetWidth) /
            (resizable.offsetHeight - resizer.aspectRatioOffsetHeight);
          resizer.maintainAspectRatio = true;
        } else {
          resizer.maintainAspectRatio = false;
        }
      }
    });

    const toggleMoveButton = root.getElementById(
      "toggle-move",
    ) as HTMLInputElement;
    if (!toggleMoveButton) {
      throw "toggleMoveButton is null";
    }
    toggleMoveButton.checked = mover.movable;
    toggleMoveButton.addEventListener("change", (e: Event) => {
      if (e.target === toggleMoveButton) {
        mover.movable = toggleMoveButton.checked;
        updateResizableBorder();
      }
    });
    const moveHandler = (e: Event) => {
      if (!(e instanceof MoveEvent)) {
        throw "Wrong event type -- expected MoveEvent";
      }
      switch (e.type) {
        case "moveend":
        case "movecancel": {
          toggleMoveButton.checked = false;
          mover.movable = false;
          updateResizableBorder();
          break;
        }
      }
    };
    resizable.addEventListener("movestart", moveHandler);
    resizable.addEventListener("moveend", moveHandler);
    resizable.addEventListener("movecancel", moveHandler);
    resizable.addEventListener("move", moveHandler);
  }

  connectedCallback() { }

  attributeChangedCallback(
    _name: string,
    _oldValue: string,
    _newValue: string,
  ) { }
}
