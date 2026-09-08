"use client";

import { useEffect, useState } from "react";
import { reducedMotion } from "@swiss-now/motion/tokens";

const QUERY = "(prefers-reduced-motion: reduce)";

/** The user's preference at call time (false during server rendering). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}

/** Live preference for components; false until mounted so server and client agree. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/**
 * Schedules the next canvas frame: every frame normally, once a second under reduced motion so the
 * marks still update without ambient motion. Returns a handle for `cancelFrame`.
 */
export function nextFrame(cb: FrameRequestCallback): number {
  if (prefersReducedMotion())
    return window.setTimeout(() => cb(performance.now()), reducedMotion.frameIntervalMs);
  return requestAnimationFrame(cb);
}

export function cancelFrame(handle: number): void {
  cancelAnimationFrame(handle);
  clearTimeout(handle);
}
