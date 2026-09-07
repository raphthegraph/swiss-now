import type { LonLat } from "@swiss-now/core";

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number): number => (d * Math.PI) / 180;
const toDeg = (r: number): number => (r * 180) / Math.PI;

/** Great-circle distance in metres (haversine). */
export function haversineMeters(a: LonLat, b: LonLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b` in degrees 0–360. */
export function bearingDeg(a: LonLat, b: LonLat): number {
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const dLon = toRad(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** A path with cumulative distances, precomputed once per route. */
export interface MeasuredPath {
  coordinates: LonLat[];
  /** cumulative distance in metres at each vertex; `cumulative[0] === 0` */
  cumulative: number[];
  lengthMeters: number;
}

export function measurePath(coordinates: LonLat[]): MeasuredPath {
  if (coordinates.length < 2) throw new Error("measurePath: a path needs at least 2 coordinates");
  const cumulative: number[] = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1] as LonLat;
    const cur = coordinates[i] as LonLat;
    cumulative.push((cumulative[i - 1] as number) + haversineMeters(prev, cur));
  }
  return { coordinates, cumulative, lengthMeters: cumulative[cumulative.length - 1] as number };
}

/**
 * Position and bearing at `distanceMeters` along a measured path (clamped to the path).
 * Linear interpolation between vertices is adequate at Swiss route scales.
 */
export function positionAlongPath(
  path: MeasuredPath,
  distanceMeters: number,
): { lonLat: LonLat; bearing: number; progress: number } {
  const d = Math.max(0, Math.min(path.lengthMeters, distanceMeters));
  const { coordinates, cumulative } = path;
  // binary search for the segment
  let lo = 0;
  let hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cumulative[mid] as number) <= d) lo = mid;
    else hi = mid;
  }
  const a = coordinates[lo] as LonLat;
  const b = coordinates[hi] as LonLat;
  const segLen = (cumulative[hi] as number) - (cumulative[lo] as number);
  const t = segLen > 0 ? (d - (cumulative[lo] as number)) / segLen : 0;
  const lonLat: LonLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return {
    lonLat,
    bearing: bearingDeg(a, b),
    progress: path.lengthMeters > 0 ? d / path.lengthMeters : 0,
  };
}
