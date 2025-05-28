import "./style.css";
import faceland from "../public/Faceland.png";
import animatedSeal from "../public/seal.png";
import fuecoco from "../public/Fuecoco.png";
import daiki from "../public/Daiki.png";
import cabbaggy from "../public/cabbaggy.png";
import guangdang from "../public/Guangdang.png";
import { ZoomableView } from "./components/zoomable-view";

ZoomableView.register();

const app = document.getElementById("app");
if (!app) {
  throw "app is null";
}

app.innerHTML = `
  <div id="render-area">
    <zoomable-view id="zoomable-view"
      view-margin-left="-50vw"
      view-margin-right="-50vw"
      view-margin-top="-50vh"
      view-margin-bottom="-50vh"
    >
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
          <img src="${guangdang}" width=70 />
        </div>
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
