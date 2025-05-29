export type Point2D = { x: number; y: number };

export function sum(u: Point2D, v: Point2D): Point2D {
  return {
    x: u.x + v.x,
    y: u.y + v.y,
  }
}

export function diff(u: Point2D, v: Point2D): Point2D {
  return {
    x: u.x - v.x,
    y: u.y - v.y,
  }
}

export function scale(scale: number, u: Point2D): Point2D {
  return {
    x: scale * u.x,
    y: scale * u.y,
  };
}

export function dot(u: Point2D, v: Point2D): number {
  return u.x * v.x + u.y * v.y;
}

export function cross(u: Point2D, v: Point2D): number {
  return u.x * v.y - u.y * v.x;
}

export function normSquared(u: Point2D): number {
  return u.x ** 2 + u.y ** 2;
}

export function norm(u: Point2D): number {
  return Math.sqrt(normSquared(u));
}

export function dist(u: Point2D, v: Point2D): number {
  return norm(diff(u, v));
}

/**
 * Computes the projection of `u` on `v`.
 *
 * `v` must be non-zero.
 */
export function project(u: Point2D, v: Point2D): Point2D {
  if ((u.x === 0) && (u.y === 0)) {
    return { x: 0, y: 0 };
  }
  return scale(dot(u, v) / normSquared(v), v);
}

/**
 * Computes the length of the projection of `u` on `v`.
 *
 * This can be negative if `u` points into the opposite direction of `v`.
 */
export function projectionLength(u: Point2D, v: Point2D): number {
  if ((u.x === 0) && (u.y === 0)) {
    return 0;
  }
  return dot(u, v) / norm(v);
}

export function centroid(points: Iterable<Point2D>): Point2D {
  let i = 0;
  let sumX = 0;
  let sumY = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    ++i;
  }
  return i === 0 ? { x: 0, y: 0 } : { x: sumX / i, y: sumY / i };
}

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
    }
    e = e.parentElement;
  }
  const point = new DOMPointReadOnly(x, y).matrixTransform(m.inverse());
  return { x: point.x, y: point.y };
}

