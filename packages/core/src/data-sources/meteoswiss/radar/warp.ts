/**
 * Warps the LV95 radar grid into a Web Mercator (EPSG:3857) RGBA image so MapLibre can draw it as
 * a plain `image` source with axis-aligned corners. The per-pixel lookup is computed once per
 * process (≈ 0.5 M proj4 calls) and reused for every frame.
 */
import { PNG } from "pngjs";
import { wgs84ToLv95 } from "../../../geo/proj";
import type { RadarGrid } from "./decode";

export type Rgba = readonly [number, number, number, number];
/** Maps a value (mm/h or mm) to a colour; alpha 0 hides the pixel. Shared scales live in @swiss-now/motion. */
export type ColorRamp = (value: number) => Rgba;

export interface WarpedImage {
  width: number;
  height: number;
  /** WGS84 [west, south, east, north] of the image — exact because the image is Mercator-aligned */
  bounds: [number, number, number, number];
  png: Buffer;
}

const R = 6378137;
const mercX = (lon: number): number => (R * lon * Math.PI) / 180;
const mercY = (lat: number): number => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invLon = (x: number): number => (x / R) * (180 / Math.PI);
const invLat = (y: number): number =>
  (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);

/** Output raster definition: fixed for the Swiss composite so the lookup table can be cached. */
export const RADAR_OUTPUT = {
  width: 720,
  height: 720,
  /** WGS84 bounds covering the LV95 grid corners with a small margin (verified corners: 2.69–12.46 E, 43.62–49.37 N) */
  bounds: [2.6, 43.55, 12.5, 49.45] as [number, number, number, number],
} as const;

let lookup: Int32Array | undefined;

/** Precomputes, for every output pixel, the source grid index (or -1). */
function buildLookup(
  grid: Pick<RadarGrid, "width" | "height" | "originEast" | "originNorth" | "cellMeters">,
): Int32Array {
  const { width: ow, height: oh, bounds } = RADAR_OUTPUT;
  const x0 = mercX(bounds[0]);
  const x1 = mercX(bounds[2]);
  const y0 = mercY(bounds[3]); // top
  const y1 = mercY(bounds[1]); // bottom
  const table = new Int32Array(ow * oh);
  for (let py = 0; py < oh; py++) {
    const lat = invLat(y0 + ((y1 - y0) * (py + 0.5)) / oh);
    for (let px = 0; px < ow; px++) {
      const lon = invLon(x0 + ((x1 - x0) * (px + 0.5)) / ow);
      const [east, north] = wgs84ToLv95([lon, lat]);
      const col = Math.floor((east - grid.originEast) / grid.cellMeters);
      const row = Math.floor((grid.originNorth - north) / grid.cellMeters);
      table[py * ow + px] =
        col >= 0 && col < grid.width && row >= 0 && row < grid.height ? row * grid.width + col : -1;
    }
  }
  return table;
}

export function warpToMercatorPng(grid: RadarGrid, ramp: ColorRamp): WarpedImage {
  const { width: ow, height: oh, bounds } = RADAR_OUTPUT;
  if (!lookup) lookup = buildLookup(grid);
  const png = new PNG({ width: ow, height: oh });
  const data = png.data;
  for (let i = 0; i < ow * oh; i++) {
    const src = lookup[i] as number;
    const o = i * 4;
    if (src < 0) {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
      continue;
    }
    const v = grid.values[src] as number;
    if (Number.isNaN(v) || v <= 0) {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 0;
      continue;
    }
    const [r, g, b, a] = ramp(v);
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = a;
  }
  return { width: ow, height: oh, bounds: [...bounds], png: PNG.sync.write(png, { colorType: 6 }) };
}

/** Share of grid cells inside the Swiss bounding box with rain above `thresholdMmH`. */
export function rainingShareOfSwitzerland(grid: RadarGrid, thresholdMmH = 0.1): number {
  // Switzerland in LV95 roughly: E 2 485 000–2 834 000, N 1 075 000–1 296 000 (bounding box, includes some abroad)
  const c0 = Math.floor((2_485_000 - grid.originEast) / grid.cellMeters);
  const c1 = Math.floor((2_834_000 - grid.originEast) / grid.cellMeters);
  const r0 = Math.floor((grid.originNorth - 1_296_000) / grid.cellMeters);
  const r1 = Math.floor((grid.originNorth - 1_075_000) / grid.cellMeters);
  let n = 0;
  let wet = 0;
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const v = grid.values[r * grid.width + c] as number;
      if (Number.isNaN(v)) continue;
      n++;
      if (v >= thresholdMmH) wet++;
    }
  }
  return n ? wet / n : 0;
}
