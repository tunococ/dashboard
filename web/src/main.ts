import "./style.css";
import daiki from "../public/Daiki.png";
import faceland from "../public/Faceland.png";
import fuecoco from "../public/Fuecoco.png";
import guangdang from "../public/Guangdang.png";
import cabbaggy from "../public/cabbaggy.png";
import animatedSeal from "../public/seal.png";
import { ZoomableView } from "./components/zoomable-view";

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
          <button id="zoom-to-fit">Zoom to fit</button>
          <button id="toggle-fullscreen"></button>
        </div>
        <div style="position: absolute; top: 1rem; right: 1rem;">
          <button id="login">Log in</button>
        </div>
      </div>
      <div id="dashboard" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div id="clock" style="white-space:pre;">
        </div>
        <div style="display: flex; flex-direction: row; align-items: center; justify-content: center;">
          <img src="${animatedSeal}" width=70 />
          <img src="${fuecoco}" width=70 />
          <img src="${daiki}" width=70 />
          <img src="${cabbaggy}" width=70 />
          <img src="${guangdang}" width=70 />
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
const background = document.getElementById("background")
if (!background) {
  throw "background is null";
}

let hideOverlay: number | undefined = undefined
background.addEventListener("pointermove", () => {
  clearTimeout(hideOverlay);
  overlay.style.opacity = "1";
  hideOverlay = setTimeout(() => {
    overlay.style.opacity = "0";
  }, 5000);
})

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
})

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
})

const loginButton = document.getElementById("login");
if (!loginButton) {
  throw "loginButton is null";
}

// Content

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

setTimeout(() => zoomableView.zoomToFit(true), 0);
