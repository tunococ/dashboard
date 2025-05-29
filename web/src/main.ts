import "./style.css";
import daiki from "../public/Daiki.png";
import faceland from "../public/Faceland.png";
import fuecoco from "../public/Fuecoco.png";
import guangdang from "../public/Guangdang.png";
import cabbaggy from "../public/cabbaggy.png";
import animatedSeal from "../public/seal.png";
import { ZoomableView } from "./components/zoomable-view";
import { ElementResizer, ResizeEvent } from "./event-handlers/element-resizer";

ZoomableView.register();

const app = document.getElementById("app");
if (!app) {
  throw "app is null";
}

app.innerHTML = `
  <div id="render-area">
    <zoomable-view id="zoomable-view"
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
          <button id="zoom-to-fit" style="pointer-events: auto">Zoom to fit</button>
          <button id="toggle-fullscreen" style="pointer-events: auto"></button>
        </div>
        <div style="position: absolute; top: 1rem; right: 1rem;">
          <button id="login" style="pointer-events: auto">Log in</button>
        </div>
      </div>
      <div id="dashboard" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 500px; height: 500px;">
        <div id="clock" style="white-space:pre;">
        </div>
        <div style="display: flex; flex-direction: row; align-items: center; justify-content: center;">
          <img src="${animatedSeal}" width=70 />
          <img src="${fuecoco}" width=70 />
          <img src="${daiki}" width=70 />
          <img src="${cabbaggy}" width=70 />
          <img src="${guangdang}" width=70 />
        </div>
        <div id="resizable" style="position: absolute; pointer-events: auto; bottom: 1em; left: 1em; width: 5em; height: 5em; background-color: #f00;">
          <div id="resizable-interior" style="position: absolute; top: 5px; right: 5px; bottom: 5px; left: 5px; background-color: #ddf; overflow: scroll;">
            <div style="position: absolute; left: 5px; right: 5px; top: 5px; bottom: 5px;">
              <input type="checkbox" id="toggle-aspect-ratio" name="toggle-aspect-ratio"
                />
              <label for="toggle-aspect-ratio">Maintain aspect ratio</label>
            </div>
          </div>
        </div>
      </div>
    </zoomable-view>
  </div>
`;

const renderArea = document.querySelector("#render-area");
if (!renderArea) {
  throw "renderArea is null";
}

const zoomableView = document.getElementById("zoomable-view") as ZoomableView;
if (!zoomableView) {
  throw "zoomableView is null";
}
zoomableView.style.color = "blue";

// Background

const background = document.getElementById("background");
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

const overlay = document.getElementById("overlay") as HTMLDivElement;
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

const toggleFullscreenButton = document.getElementById("toggle-fullscreen");
if (!toggleFullscreenButton) {
  throw "toggleFullscreenButton is null";
}
const updateToggleFullscreenButton = () => {
  if (document.fullscreenElement) {
    toggleFullscreenButton.textContent = "Exit fullscreen";
  } else {
    toggleFullscreenButton.textContent = "Enter fullscreen";
  }
};
document.addEventListener("fullscreenchange", updateToggleFullscreenButton);
toggleFullscreenButton.addEventListener("click", (event: MouseEvent) => {
  if (event.target === toggleFullscreenButton) {
    event.preventDefault();
    event.stopPropagation();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      renderArea.requestFullscreen();
    }
    updateToggleFullscreenButton();
  }
});
updateToggleFullscreenButton();

const zoomToFitButton = document.getElementById("zoom-to-fit");
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

const loginButton = document.getElementById("login");
if (!loginButton) {
  throw "loginButton is null";
}

// Content

setTimeout(() => zoomableView.zoomToFit(true), 0);

const clock = document.getElementById("clock");
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

const resizable = document.getElementById("resizable");
if (!resizable) {
  throw "resizable is null";
}
const resizer = new ElementResizer({
  resizeBorderWidth: 5,
  aspectRatioOffsetHeight: 10,
  aspectRatioOffsetWidth: 10,
});
resizer.install(resizable);
const resizeHandler = (e: Event) => {
  if (!(e instanceof ResizeEvent)) {
    throw "Wrong event type -- expected ResizeEvent";
  }
  console.log(
    `ResizeEvent: type=${e.type}, direction=${e.resizeDirection}, width=${e.width}, height=${e.height}`,
  );
};
resizable.addEventListener("resizestart", resizeHandler);
resizable.addEventListener("resizeend", resizeHandler);
resizable.addEventListener("resizecancel", resizeHandler);
resizable.addEventListener("resizemove", resizeHandler);
resizable.addEventListener("resize", resizeHandler);

const toggleAspectRatioButton = document.getElementById("toggle-aspect-ratio") as HTMLInputElement
if (!toggleAspectRatioButton) {
  throw "maintainAspectRatioButton is null";
}
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
    e.stopPropagation();
  }
})

