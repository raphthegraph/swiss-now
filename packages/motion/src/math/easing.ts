import type { Bezier } from "../tokens/motion.js";
import { easing } from "../tokens/motion.js";

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Cubic-bezier easing evaluated by Newton iteration — identical results in browsers and Remotion.
 * `x` is progress 0–1; returns eased progress.
 */
export function cubicBezier(curve: Bezier, x: number): number {
  const [x1, y1, x2, y2] = curve;
  const t = clamp01(x);
  if (t === 0 || t === 1) return t;
  // solve for parametric u such that bx(u) = t
  let u = t;
  for (let i = 0; i < 8; i++) {
    const bx = bezier1d(x1, x2, u) - t;
    const dx = bezierDerivative(x1, x2, u);
    if (Math.abs(bx) < 1e-6) break;
    if (Math.abs(dx) < 1e-6) break;
    u -= bx / dx;
    u = clamp01(u);
  }
  return bezier1d(y1, y2, u);
}

function bezier1d(p1: number, p2: number, u: number): number {
  const mu = 1 - u;
  return 3 * mu * mu * u * p1 + 3 * mu * u * u * p2 + u * u * u;
}
function bezierDerivative(p1: number, p2: number, u: number): number {
  const mu = 1 - u;
  return 3 * mu * mu * p1 + 6 * mu * u * (p2 - p1) + 3 * u * u * (1 - p2);
}

/** The house curve as a function. */
export const easeHouse = (t: number): number => cubicBezier(easing.house, t);
export const easeExit = (t: number): number => cubicBezier(easing.exit, t);
