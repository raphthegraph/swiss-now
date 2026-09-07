/**
 * Motion tokens. Durations in milliseconds; easings as cubic-bezier control points so that
 * Motion/GSAP (web) and Remotion `Easing.bezier` (video) share one definition.
 */
export const duration = {
  hover: 120,
  panel: 240,
  layerSwitch: 480,
  cameraGlide: 900,
  chapter: 1800,
} as const;
export type DurationKey = keyof typeof duration;

export type Bezier = readonly [number, number, number, number];

export const easing = {
  /** House curve: fast out, long settle. */
  house: [0.16, 1, 0.3, 1] as Bezier,
  /** For continuous data motion (particles, flows): never eased. */
  linear: [0, 0, 1, 1] as Bezier,
  /** For elements leaving the stage. */
  exit: [0.7, 0, 0.84, 0] as Bezier,
} as const;

export const cssEasing = {
  house: `cubic-bezier(${easing.house.join(", ")})`,
  linear: "linear",
  exit: `cubic-bezier(${easing.exit.join(", ")})`,
} as const;

/** Reduced-motion variants: everything shortens, nothing loops. */
export const reducedMotion = {
  duration: 80,
  particles: false,
  flows: "static-dash",
  pulses: "ring-only",
} as const;

/** Periods for looping data motion, in ms. */
export const period = {
  delayPulse: 2400,
  quakeRing: 3200,
  dangerPulse: 2000,
  incidentPulse: 1600,
} as const;
