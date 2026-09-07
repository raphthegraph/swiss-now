/**
 * Discovery of MeteoSwiss precipitation radar assets on the geo.admin.ch STAC API.
 * Verified 2026-09-07/08: collection `ch.meteoschweiz.ogd-radar-precip`, one item per UTC day
 * (`YYYYMMDD-ch`, tomorrow's item exists and is empty), assets named e.g.
 * `rzc262502210vl.001.h5` = product RZC, yy=26, day-of-year 250, 22:10 UTC, radar-availability code.
 * Filenames are not deterministic → always list assets.
 */
import { z } from "zod";
import { SWISS_NOW_USER_AGENT } from "../../geoadmin/client";

export const RADAR_COLLECTION = "ch.meteoschweiz.ogd-radar-precip";
export const STAC_BASE = "https://data.geo.admin.ch/api/stac/v1";

export type RadarProduct = "RZC" | "CPC";

export interface RadarAsset {
  /** asset key, e.g. `rzc262502210vl.001.h5` — also used as our frame id */
  id: string;
  product: RadarProduct;
  href: string;
  /** end of the 5-minute interval the composite represents (UTC) */
  validAt: string;
  updated?: string;
}

const StacItem = z.object({
  id: z.string(),
  assets: z.record(
    z.string(),
    z
      .object({ href: z.url(), updated: z.string().optional(), type: z.string().optional() })
      .loose(),
  ),
});

export const RADAR_ASSET_ID = /^(rzc|cpc)(\d{2})(\d{3})(\d{2})(\d{2})[0-9a-z_.]*\.h5$/i;

/** Parses `rzc262502210vl.001.h5` → { product: "RZC", validAt: 2026-09-07T22:10:00Z }. */
export function parseRadarAssetId(
  id: string,
): { product: RadarProduct; validAt: string } | undefined {
  const m = RADAR_ASSET_ID.exec(id);
  if (!m) return undefined;
  const [, prod, yy, doy, hh, mm] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const year = 2000 + Number(yy);
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(Number(doy));
  date.setUTCHours(Number(hh), Number(mm), 0, 0);
  return { product: prod.toUpperCase() as RadarProduct, validAt: date.toISOString() };
}

export function stacDayId(date: Date): string {
  return `${date.toISOString().slice(0, 10).replaceAll("-", "")}-ch`;
}

export interface ListRadarOptions {
  fetch?: typeof fetch;
  product?: RadarProduct;
  /** how many most-recent frames to return */
  limit?: number;
  now?: Date;
}

/**
 * Lists the most recent radar frames, newest first. Reads today's item and, within the first two
 * hours of a UTC day, yesterday's as well so the 3-hour timeline never starts empty.
 */
export async function listRadarFrames(opts: ListRadarOptions = {}): Promise<RadarAsset[]> {
  const doFetch = opts.fetch ?? fetch;
  const product = opts.product ?? "RZC";
  const now = opts.now ?? new Date();
  const days = [stacDayId(now)];
  if (now.getUTCHours() < 2) days.push(stacDayId(new Date(now.getTime() - 86_400_000)));

  const frames: RadarAsset[] = [];
  for (const day of days) {
    const res = await doFetch(`${STAC_BASE}/collections/${RADAR_COLLECTION}/items/${day}`, {
      headers: { "User-Agent": SWISS_NOW_USER_AGENT, Accept: "application/json" },
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`STAC ${day} responded ${res.status}`);
    const item = StacItem.parse(await res.json());
    for (const [id, asset] of Object.entries(item.assets)) {
      const parsed = parseRadarAssetId(id);
      if (!parsed || parsed.product !== product) continue;
      const frame: RadarAsset = {
        id,
        product: parsed.product,
        href: asset.href,
        validAt: parsed.validAt,
      };
      if (asset.updated) frame.updated = asset.updated;
      frames.push(frame);
    }
  }
  frames.sort((a, b) => (a.validAt < b.validAt ? 1 : a.validAt > b.validAt ? -1 : 0));
  return frames.slice(0, opts.limit ?? 36);
}

/** Builds the canonical download URL for an asset id (guards against path injection). */
export function radarAssetHref(id: string, day: string): string | undefined {
  if (!RADAR_ASSET_ID.test(id) || !/^\d{8}-ch$/.test(day)) return undefined;
  return `https://data.geo.admin.ch/${RADAR_COLLECTION}/${day}/${id}`;
}
