export class ZoomableView extends HTMLElement {

  static register(name: string = "zoomable-view") {
    customElements.define(
      name,
      ZoomableView,
    )
    console.log("zoomable-view registered")
  }

  container: HTMLDivElement
  content: HTMLDivElement
  background: HTMLDivElement

  constructor() {
    super()
    console.log(`ZoomableView created`)

    const template = document.createElement("template")
    template.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        #container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          isolation: isolate;
        }
        #background {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: -1;
        }
        #content {
        }
      </style>
      <div id="container" part="container">
        <div id="background">
          <slot name="background"></slot>
        </div>
        <div id="content">
          <slot></slot>
        </div>
      </div>
    `

    const shadowRoot = this.attachShadow({ mode: "open" })
    shadowRoot.append(template.content.cloneNode(true))

    const container = shadowRoot.getElementById("container") as HTMLDivElement
    const content = shadowRoot.getElementById("content") as HTMLDivElement
    const background = shadowRoot.getElementById("background") as HTMLDivElement

    this.container = container
    this.background = background
    this.content = content

    this.container.addEventListener("wheel", (e: Event) => this.onWheelEvent(e))
  }

  static readonly observedAttributes = [
    "zoom-speed",
    "min-zoom",
    "max-zoom",
    "current-zoom",
    "bound-top",
    "bound-right",
    "bound-bottom",
    "bound-left",
  ]

  static readonly defaultAttributes: Record<string, any> = {
    "zoom-speed": 0.01,
    "min-zoom": 0.1,
    "max-zoom": 10,
    "current-zoom": 1,
    "bound-top": 0,
    "bound-right": 1920,
    "bound-bottom": 1080,
    "bound-left": 0,
  }

  private getNumberAttribute(name: string) {
    const num = parseFloat(this.getAttribute(name)!)
    return isNaN(num) ? ZoomableView.defaultAttributes[name] : num;
  }

  get zoomSpeed(): number {
    return this.getNumberAttribute("zoom-speed")
  }
  set zoomSpeed(value: any) {
    this.setAttribute("zoom-speed", value.toString())
  }
  get minZoom(): number {
    return this.getNumberAttribute("min-zoom")
  }
  set minZoom(value: any) {
    this.setAttribute("min-zoom", value.toString())
  }
  get maxZoom(): number {
    return this.getNumberAttribute("max-zoom")
  }
  set maxZoom(value: any) {
    this.setAttribute("max-zoom", value.toString())
  }
  get currentZoom(): number {
    return this.getNumberAttribute("current-zoom")
  }
  set currentZoom(value: any) {
    console.log(`setting currentZoom to ${value}`)
    this.setAttribute("current-zoom", value.toString())
  }
  get boundTop(): number {
    return this.getNumberAttribute("bound-top")
  }
  set boundTop(value: any) {
    this.setAttribute("bound-top", value.toString())
  }
  get boundRight(): number {
    return this.getNumberAttribute("bound-right")
  }
  set boundRight(value: any) {
    this.setAttribute("bound-right", value.toString())
  }
  get boundbottom(): number {
    return this.getNumberAttribute("bound-bottom")
  }
  set boundbottom(value: any) {
    this.setAttribute("bound-bottom", value.toString())
  }
  get boundLeft(): number {
    return this.getNumberAttribute("bound-left")
  }
  set boundLeft(value: any) {
    this.setAttribute("bound-left", value.toString())
  }

  connectedCallback() {
    // const slottedElements = this.querySelectorAll("slot")
    // for (const slottedElement of slottedElements) {
    //   if (slottedElement.slot === "background") {
    //
    //   }
    // }
    //
    // this.addEventListener("wheel", (e) => this.onWheelEvent(e), { passive: false })
    // console.log(`currentZoom is now ${this.currentZoom}`)
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    switch (name) {
      case "current-zoom": {
        const currentZoom = parseFloat(newValue)
        this.content.style.setProperty("transform", `scale(${currentZoom})`)
        console.log(`currentZoom=${newValue} (${oldValue} => ${newValue})`)
        break
      }
      case "max-zoom":
      case "min-zoom": {
        this.validateZoom()
        break
      }
    }
  }

  changeZoom(delta: number): boolean {
    const currentZoom = this.currentZoom
    const zoomDelta = -delta * this.zoomSpeed
    const newZoom = currentZoom + zoomDelta
    if (zoomDelta > 0) {
      const maxZoom = this.maxZoom
      if (currentZoom >= maxZoom) {
        return false
      }
      this.currentZoom = Math.min(newZoom, maxZoom)
    } else if (zoomDelta < 0) {
      const minZoom = this.minZoom
      if (currentZoom <= minZoom) {
        return false
      }
      this.currentZoom = Math.max(newZoom, minZoom)
    }
    return true
  }


  private onWheelEvent(e: Event) {
    const event = e as WheelEvent
    console.log(`wheelEvent: deltaY = ${event.deltaY}`)
    if (this.changeZoom(event.deltaY)) {
      event.preventDefault()
    }
  }

  private validateZoom() {
    const maxZoom = this.maxZoom
    const minZoom = this.minZoom
    if (maxZoom < minZoom) {
      this.currentZoom = 0.5 * (maxZoom + minZoom)
      return
    }
    this.currentZoom = Math.max(Math.min(this.currentZoom, maxZoom), minZoom)
  }

}

