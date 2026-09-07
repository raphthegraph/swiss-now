/**
 * Coordinate transforms. Swiss Now stores WGS84 `[lon, lat]`; Swiss sources publish LV95 (EPSG:2056).
 * LV95 is a Hotine Oblique Mercator (`+proj=somerc`) that d3-geo does not implement, hence proj4.
 */
import proj4 from "proj4";
import type { LonLat } from "../state/common";

export const EPSG_2056 =
  "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs";

proj4.defs("EPSG:2056", EPSG_2056);

/** LV95 easting/northing (metres) → WGS84 [lon, lat]. */
export function lv95ToWgs84([east, north]: readonly [number, number]): LonLat {
  const [lon, lat] = proj4("EPSG:2056", "WGS84", [east, north]) as [number, number];
  return [round(lon, 6), round(lat, 6)];
}

/** WGS84 [lon, lat] → LV95 easting/northing (metres). */
export function wgs84ToLv95([lon, lat]: LonLat): [number, number] {
  const [east, north] = proj4("WGS84", "EPSG:2056", [lon, lat]) as [number, number];
  return [round(east, 2), round(north, 2)];
}

/** Heuristic: LV95 eastings are ~2.48–2.84 million, northings ~1.07–1.30 million. */
export function looksLikeLv95([x, y]: readonly [number, number]): boolean {
  return x > 2_000_000 && x < 3_000_000 && y > 1_000_000 && y < 1_400_000;
}

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
