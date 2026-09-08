import type { LonLat } from "../../state/common";

const R = 6_371_008.8;
const rad = (d: number): number => (d * Math.PI) / 180;

/** Great-circle distance in metres (duplicated from @swiss-now/motion to keep core dependency-free). */
export function haversineMeters(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
