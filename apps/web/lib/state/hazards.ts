import { fetchFireDanger } from "@swiss-now/core/data-sources/bafu-fire";
import { fetchBulletin, fetchImis } from "@swiss-now/core/data-sources/slf";
import {
  hailInSeason,
  listHailFrames,
  type HailAsset,
} from "@swiss-now/core/data-sources/meteoswiss/hail";
import { decodeOdimComposite, type RadarGrid } from "@swiss-now/core/data-sources/meteoswiss/radar";
import { RADAR_OUTPUT } from "@swiss-now/core/data-sources/meteoswiss/radar";
import { buildHazardsState } from "@swiss-now/core/data-sources/hazards";
import type { Field, HazardsState } from "@swiss-now/core/state";

export const HAZARDS_TTL_SECONDS = 600;
const cached =
  (revalidate: number, tag: string) =>
  (url: string, init?: RequestInit): Promise<Response> =>
    fetch(url, { ...init, next: { revalidate, tags: [tag] } });

const GEOJSON_URLS = {
  fire: "/api/hazards/regions/fire",
  avalanche: "/api/hazards/regions/avalanche",
};
const hailFrames = new Map<string, HailAsset>();
const hailGrids = new Map<string, Promise<RadarGrid>>();

/** Fire (daily), the bulletin (hourly), IMIS (30 min) and, in season, the newest hail frame with hail in it. */
export async function getHazardsState(now = new Date()): Promise<HazardsState> {
  const [fire, bulletin, imis, hail] = await Promise.allSettled([
    fetchFireDanger(cached(3600, "state:hazards-fire") as typeof fetch),
    fetchBulletin(cached(3600, "state:hazards-bulletin") as typeof fetch),
    fetchImis(cached(1800, "state:hazards-imis") as typeof fetch),
    hailInSeason(now) ? newestHailField(now) : Promise.resolve(undefined),
  ]);
  const ok = <T>(r: PromiseSettledResult<T>): T | undefined =>
    r.status === "fulfilled" ? r.value : undefined;
  const f = ok(fire);
  const b = ok(bulletin);
  return buildHazardsState(
    {
      fire: f ? { regions: f.regions, issuedAt: f.issuedAt } : undefined,
      avalanche: b ? { regions: b.regions } : undefined,
      snow: ok(imis),
      hail: ok(hail),
      geojsonUrls: GEOJSON_URLS,
    },
    now,
  );
}

/** Region polygons (WGS84) for the map, cached an hour. */
export async function getRegionGeoJson(kind: "fire" | "avalanche"): Promise<unknown> {
  if (kind === "fire")
    return (await fetchFireDanger(cached(3600, "state:hazards-fire") as typeof fetch)).geojson;
  return (await fetchBulletin(cached(3600, "state:hazards-bulletin") as typeof fetch)).raw;
}

export async function getHailGrid(id: string): Promise<RadarGrid | undefined> {
  const asset = hailFrames.get(id);
  if (!asset) return undefined;
  let p = hailGrids.get(id);
  if (!p) {
    p = fetch(asset.href, { next: { revalidate: 86_400 } })
      .then((r) => {
        if (!r.ok) throw new Error(`hail ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => decodeOdimComposite(new Uint8Array(buf)));
    hailGrids.set(id, p);
    p.catch(() => hailGrids.delete(id));
    if (hailGrids.size > 24) hailGrids.delete(hailGrids.keys().next().value!);
  }
  return p;
}

/** The newest frame in the last hour whose grid has any hail; undefined when the sky is quiet. */
async function newestHailField(now: Date): Promise<Field | undefined> {
  const frames = await listHailFrames(cached(300, "state:hazards-hail") as typeof fetch, now, 12);
  for (const f of frames) hailFrames.set(f.id, f);
  for (const f of [...frames].reverse()) {
    if (now.getTime() - new Date(f.validAt).getTime() > 3_600_000) break;
    const grid = await getHailGrid(f.id);
    if (!grid) continue;
    let any = false;
    for (const v of grid.values) if (v > 0) ((any = true), void 0);
    if (any)
      return {
        id: f.id,
        kind: "hail-meshs",
        bounds: RADAR_OUTPUT.bounds as [number, number, number, number],
        width: RADAR_OUTPUT.width,
        height: RADAR_OUTPUT.height,
        imageUrl: `/api/hail/${f.id}`,
        scaleId: "hail",
        validAt: f.validAt,
        source: "meteoswiss-hail",
      };
  }
  return undefined;
}
