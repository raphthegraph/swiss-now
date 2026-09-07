import type { LonLat, TripSnapshot, TripStop } from "@swiss-now/core";
import { positionAlongPath, type MeasuredPath } from "./geo";

export interface TripPosition {
  lonLat: LonLat;
  bearing: number;
  /** 0–1 along the whole path */
  progress: number;
  /** distance along the path in metres */
  distanceMeters: number;
  /** index of the last stop departed (−1 before the first departure) */
  lastStopIndex: number;
  /** true while dwelling at a stop */
  dwelling: boolean;
  /** `interpolated` for every Swiss train today — no vehicle positions are published */
  positionKind: TripSnapshot["positionKind"];
  /** current delay in seconds applied at this point of the trip */
  delaySeconds: number;
  /** false before the first departure or after the last arrival */
  active: boolean;
}

const ms = (iso: string): number => new Date(iso).getTime();
const effArrival = (s: TripStop): number => ms(s.scheduledArrival) + s.delaySeconds * 1000;
const effDeparture = (s: TripStop): number => ms(s.scheduledDeparture) + s.delaySeconds * 1000;

/**
 * Interpolated position of a trip at time `t`. Identical on web (t = Date.now()) and in
 * Remotion (t = frame → time). Delays shift the schedule per stop; between stops the vehicle moves
 * at constant speed along the path; at stops it dwells between effective arrival and departure.
 * Skipped stops are passed through without dwelling.
 *
 * If `trip.positionKind === "reported"` and `reportedLonLat` is present the reported position is
 * returned unchanged with `progress` estimated from the schedule — Swiss Now never fabricates GPS.
 */
export function positionAlongTrip(
  trip: TripSnapshot,
  path: MeasuredPath,
  t: number | Date,
): TripPosition {
  const now = t instanceof Date ? t.getTime() : t;
  const stops = trip.stops.filter((s) => !s.skipped);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last)
    throw new Error("positionAlongTrip: trip needs at least two non-skipped stops");

  const base = (
    d: number,
    lastStopIndex: number,
    dwelling: boolean,
    delay: number,
    active: boolean,
  ): TripPosition => {
    const p = positionAlongPath(path, d);
    const lonLat =
      trip.positionKind === "reported" && trip.reportedLonLat ? trip.reportedLonLat : p.lonLat;
    return {
      lonLat,
      bearing: p.bearing,
      progress: p.progress,
      distanceMeters: d,
      lastStopIndex,
      dwelling,
      positionKind: trip.positionKind,
      delaySeconds: delay,
      active,
    };
  };

  if (now < effDeparture(first)) {
    return base(first.distanceAlongPath, -1, now >= effArrival(first), first.delaySeconds, false);
  }
  if (now >= effArrival(last)) {
    return base(last.distanceAlongPath, stops.length - 1, true, last.delaySeconds, false);
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i] as TripStop;
    const b = stops[i + 1] as TripStop;
    const dep = effDeparture(a);
    const arr = effArrival(b);
    if (now >= arr && now < effDeparture(b)) {
      // dwelling at stop b
      return base(b.distanceAlongPath, i + 1, true, b.delaySeconds, true);
    }
    if (now >= dep && now < arr) {
      const span = Math.max(1, arr - dep);
      const f = (now - dep) / span;
      const d = a.distanceAlongPath + (b.distanceAlongPath - a.distanceAlongPath) * f;
      // delay interpolates between the two stops' delays
      const delay = Math.round(a.delaySeconds + (b.delaySeconds - a.delaySeconds) * f);
      return base(d, i, false, delay, true);
    }
  }
  // dwelling at an intermediate stop where dep of a > arr of a (schedule dwell); fall through
  const idx = stops.findIndex(
    (s, i) => i < stops.length - 1 && now >= effArrival(s) && now < effDeparture(s),
  );
  const s = (idx >= 0 ? stops[idx] : first) as TripStop;
  return base(s.distanceAlongPath, Math.max(0, idx), true, s.delaySeconds, true);
}
