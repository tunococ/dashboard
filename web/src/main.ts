import "./style.css";
import faceland from "../public/Faceland.png";
import animatedSeal from "../public/seal.png";
import fuecoco from "../public/Fuecoco.png";
import daiki from "../public/Daiki.png";
import cabbaggy from "../public/cabbaggy.png";
import { ZoomableView } from "./components/zoomable-view";

ZoomableView.register();

const app = document.getElementById("app");
if (!app) {
  throw "app is null";
}

app.innerHTML = `
  <div id="render-area">
    <div id="selectable-image-url">
      <label for="user-image-url">Image URL:</label>
      <input type="text" id="user-image-url" name="user-image-url">
      <button id="image-submit">Submit</button>
    </div>
    <zoomable-view id="zoomable-view" view-margin-left=10 view-margin-right=10>
      <div slot="background" style="position: relative; width: 100%; height: 100%;">
        <img src="${faceland}" style="display: block; width:100%; height:100%; object-fit: cover; object-position: center;" />
      </div>
      <div id="dashboard" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div id="clock" style="white-space:pre;">
        </div>
        <div style="display: flex; flex-direction: row; align-items: center; justify-content: center;">
          <img src="${animatedSeal}" width=70 />
          <img src="${fuecoco}" width=70 />
          <img src="${daiki}" width=70 />
          <img src="${cabbaggy}" width=70 />
        </div>
        <img id="selected-image" src="" width=70>
      </div>
    </zoomable-view>
  </div>
`;
//          <img src="${crawlShade}" width=200 style="width:100%; height:100%; object-position: center;" />

const renderArea = document.querySelector("#render-area");
if (!renderArea) {
  throw "renderArea is null";
}

const zoomableView = document.getElementById("zoomable-view") as ZoomableView;
if (!zoomableView) {
  throw "zoomableView is null";
}
zoomableView.style.color = "blue";

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

const selectableImageUrl = document.getElementById("selectable-image-url");
if (selectableImageUrl) {
  selectableImageUrl.addEventListener("pointerdown", (e: Event) => {
    e.stopPropagation();
  });
}

const userImageURL = document.getElementById("user-image-url") as HTMLInputElement;
const imageSubmit = document.getElementById("image-submit");
const selectedImage = document.getElementById("selected-image");
if (imageSubmit) {
  imageSubmit.addEventListener("click", () => {
    selectedImage.src = userImageURL.value;
  })
}
