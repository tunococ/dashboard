import './style.css'
import { ZoomableView } from './components/zoomable-view'

ZoomableView.register()

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="render-area">
    <zoomable-view id="zoomable-view">
      <div slot="background" style="width:100%; height:100%;">
        <img src="https://images.unsplash.com/photo-1634487828605-72a3ccc3c652?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" style="object-fit: cover; width: 100%; height: 100%;">
      </div>
      <div id="clock">
      </div>
    </zoomable-view>
  </div>
`

const renderArea = document.querySelector("#render-area") as ZoomableView
if (!renderArea) {
  throw "renderArea is null"
}

const zoomableView = document.getElementById("zoomable-view")
if (!zoomableView) {
  throw "zoomableView is null"
}
zoomableView.style.color = "blue"

const clock = document.getElementById("clock")
if (!clock) {
  throw "clock is null"
}
setInterval(
  () => {
    const date = new Date()
    clock.textContent = date.toLocaleTimeString()
  },
  20,
)
