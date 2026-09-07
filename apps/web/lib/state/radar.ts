import {
  fetchRadarGrid,
  listRadarFrames,
  radarAssetHref,
  rainingShareOfSwitzerland,
  RADAR_OUTPUT,
  warpToMercatorPng,
  parseRadarAssetId,
  type ColorRamp,
  type RadarAsset,
  type RadarGrid,
} from "@swiss-now/core/data-sources/meteoswiss/radar";
import type { Field } from "@swiss-now/core";
import { rainRateColor } from "@swiss-now/motion/scales";

/** Radar composites are published every 5 minutes with ~2 minutes latency. */
export const RADAR_TTL_SECONDS = 300;
/** 3 hours of 5-minute frames for the timeline. */
export const RADAR_FRAME_LIMIT = 36;

const cachedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, next: { revalidate: RADAR_TTL_SECONDS, tags: ["state:radar"] } });

export async function getRadarFrames(): Promise<RadarAsset[]> {
  return listRadarFrames({ fetch: cachedFetch, product: "RZC", limit: RADAR_FRAME_LIMIT });
}

/** Frame → Field, pointing at our own immutable PNG route. */
export function radarFrameToField(frame: RadarAsset): Field {
  return {
    id: frame.id,
    kind: "radar-rain-rate",
    bounds: [...RADAR_OUTPUT.bounds],
    width: RADAR_OUTPUT.width,
    height: RADAR_OUTPUT.height,
    imageUrl: `/api/radar/${frame.id}`,
    scaleId: "rainRate",
    validAt: frame.validAt,
    source: "meteoswiss-radar",
  };
}

/** Resolves an asset id to its canonical, immutable href on data.geo.admin.ch. */
export function hrefForFrame(id: string): string | undefined {
  const parsed = parseRadarAssetId(id);
  if (!parsed) return undefined;
  const day = `${parsed.validAt.slice(0, 10).replaceAll("-", "")}-ch`;
  return radarAssetHref(id, day);
}

/** Immutable assets: cache the bytes for a day in the Data Cache (files are ~30–110 KB). */
export async function getRadarGrid(id: string): Promise<RadarGrid | undefined> {
  const href = hrefForFrame(id);
  if (!href) return undefined;
  const immutableFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, next: { revalidate: 86_400 } });
  return fetchRadarGrid(href, immutableFetch);
}

/** The shared rain scale (Lab-interpolated token stops) as an RGBA ramp for the warp. */
export const rainRamp: ColorRamp = (v) => {
  const c = rainRateColor(v);
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(c);
  if (!m) return [62, 109, 156, 200];
  const alphaFromScale = m[4] === undefined ? 1 : Number(m[4]);
  // fade light drizzle in smoothly; the token stop at 0 is fully transparent
  const alpha = Math.round(Math.min(1, v / 0.5) * alphaFromScale * 0.85 * 255);
  return [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
};

export function gridToPng(grid: RadarGrid): Buffer {
  return warpToMercatorPng(grid, rainRamp).png;
}

export { rainingShareOfSwitzerland };
