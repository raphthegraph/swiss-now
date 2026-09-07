/**
 * Environmental state derived from the sun's altitude over Switzerland (reference point Bern).
 * Thresholds are in degrees above the horizon.
 */
export type DaylightState = "dawn" | "day" | "dusk" | "night";

export const daylightThresholds = {
  /** Civil twilight boundary. Below this it is night. */
  night: -6,
  /** Above this it is full day. */
  day: 6,
} as const;

/** Bern, the reference point for the national environmental state. */
export const referencePoint = { lon: 7.4474, lat: 46.948 } as const;

/**
 * @param altitudeDeg sun altitude in degrees
 * @param rising whether the sun is currently rising (morning) — decides dawn vs dusk in twilight
 */
export function daylightState(altitudeDeg: number, rising: boolean): DaylightState {
  if (altitudeDeg < daylightThresholds.night) return "night";
  if (altitudeDeg >= daylightThresholds.day) return "day";
  return rising ? "dawn" : "dusk";
}
