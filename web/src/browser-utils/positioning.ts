import type { Point2D } from "../utils/geometry-2d";

export function transformFromScreenCoordinates(
  element: Element,
  x: number,
  y: number,
): Point2D {
  let e: Element | null = element;
  let m: DOMMatrixReadOnly = new DOMMatrixReadOnly();
  while (e) {
    m = new DOMMatrixReadOnly(getComputedStyle(e).transform).multiply(m);
    if (e.assignedSlot) {
      e = e.assignedSlot;
    } else if (e.parentElement) {
      e = e.parentElement;
    } else {
      const rootNode = e.getRootNode() as ShadowRoot;
      if ((e as Node) !== rootNode && rootNode.host && e !== rootNode.host) {
        e = rootNode.host;
      } else {
        e = null;
      }
    }
  }
  const point = new DOMPointReadOnly(x, y).matrixTransform(m.inverse());
  return { x: point.x, y: point.y };
}

export function getRelativeOffset(root: HTMLElement, descendant: HTMLElement) {
  if (!root.contains(descendant)) {
    throw new Error("getRelativeOffset -- root does not contain descendant");
  }
  let currentElement: HTMLElement | null = descendant;
  let top = 0;
  let left = 0;
  while (
    currentElement &&
    currentElement !== root &&
    currentElement !== document.body
  ) {
    const offsetParent: Element | null = currentElement.offsetParent;
    if (offsetParent?.contains(root)) {
      break;
    }
    top += currentElement.offsetTop;
    left += currentElement.offsetLeft;
    if (offsetParent && offsetParent !== root) {
      top -= offsetParent.scrollTop;
      left -= offsetParent.scrollLeft;
    }
    if (!(offsetParent instanceof HTMLElement)) {
      break;
    }
    currentElement = offsetParent;
  }
  return {
    top,
    left,
  };
}
