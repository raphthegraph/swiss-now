/**
 * MeteoSwiss hail products (CC BY 4.0, April–September, 5-minute): MZC = maximum expected severe
 * hail size (MESHS, mm) as ODIM HDF5 on the radar grid. Decoded with the radar pipeline.
 */
import { STAC_BASE } from "../radar/stac";
import { SWISS_NOW_USER_AGENT } from "../../geoadmin/client";

export const HAIL_COLLECTION = "ch.meteoschweiz.ogd-radar-hail";
const ASSET = /^mzc(\d{2})(\d{3})(\d{2})(\d{2})[0-9a-z_.]*\.h5$/i;

export interface HailAsset {
  id: string;
  href: string;
  /** product end time */
  validAt: string;
}

export function hailInSeason(now: Date): boolean {
  const m = now.getUTCMonth() + 1;
  return m >= 4 && m <= 9;
}

/** `mzc262511605vl.850.h5` → 2026 day 251 16:05 UTC. */
export function parseHailAssetId(id: string): { validAt: string } | undefined {
  const m = ASSET.exec(id);
  if (!m) return undefined;
  const year = 2000 + Number(m[1]);
  const day = Number(m[2]);
  const d = new Date(Date.UTC(year, 0, 1) + (day - 1) * 86_400_000);
  d.setUTCHours(Number(m[3]), Number(m[4]), 0, 0);
  return { validAt: d.toISOString() };
}

const dayId = (d: Date) => `${d.toISOString().slice(0, 10).replaceAll("-", "")}-ch`;

/** The newest hail frames of today (and yesterday around midnight), newest last. */
export async function listHailFrames(
  fetchFn: typeof fetch = fetch,
  now = new Date(),
  limit = 12,
): Promise<HailAsset[]> {
  const days = [new Date(now.getTime() - 86_400_000), now].map(dayId);
  const out: HailAsset[] = [];
  for (const day of days) {
    const res = await fetchFn(`${STAC_BASE}/collections/${HAIL_COLLECTION}/items/${day}`, {
      headers: { "user-agent": SWISS_NOW_USER_AGENT },
    });
    if (!res.ok) continue;
    const item = (await res.json()) as { assets?: Record<string, { href: string }> };
    for (const [id, a] of Object.entries(item.assets ?? {})) {
      const p = parseHailAssetId(id);
      if (p) out.push({ id, href: a.href, validAt: p.validAt });
    }
  }
  return out.sort((a, b) => (a.validAt < b.validAt ? -1 : 1)).slice(-limit);
}
