import { clamp01 } from "./easing";

/**
 * Looping pulse envelope: rises quickly, decays over the period. Returns 0–1.
 * @param tMs time in ms (web: elapsed since mount; video: frame / fps × 1000)
 * @param periodMs loop period
 * @param decay shape of the decay; 1 = linear, > 1 = faster fade
 */
export function pulseEnvelope(tMs: number, periodMs: number, decay = 2): number {
  const phase = ((tMs % periodMs) + periodMs) % periodMs;
  const p = phase / periodMs;
  return Math.pow(1 - p, decay);
}

/**
 * Expanding ring: radius grows 0→1 over the period while opacity fades 1→0.
 * `ringIndex` staggers concentric rings.
 */
export function ringProgress(
  tMs: number,
  periodMs: number,
  ringIndex = 0,
  ringCount = 1,
): { radius: number; opacity: number } {
  const offset = (ringIndex / ringCount) * periodMs;
  const phase = (((tMs + offset) % periodMs) + periodMs) % periodMs;
  const p = phase / periodMs;
  return { radius: p, opacity: Math.pow(1 - p, 1.5) };
}

/** Dash offset for a flowing line: pixels of travel at `speedPxPerSec` after `tMs`. */
export function flowDashOffset(tMs: number, speedPxPerSec: number, dashPeriodPx = 24): number {
  const travelled = (tMs / 1000) * speedPxPerSec;
  return -(travelled % dashPeriodPx);
}

/** Linear fade-in over `durationMs` starting at `startMs`; returns 0–1. */
export function fadeIn(tMs: number, startMs: number, durationMs: number): number {
  return clamp01((tMs - startMs) / durationMs);
}
