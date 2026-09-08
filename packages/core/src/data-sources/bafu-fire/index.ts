/**
 * BAFU forest-fire danger by warning region (daily; STAC `ch.bafu.gefahren-waldbrand_warnung`,
 * GeoJSON in EPSG:2056 with `level` 1–5 and localized names). Reprojected to WGS84 for the map.
 */
import type { DangerRegion } from "../../state/hazards";
import { CantonCode } from "../../state/common";
import { lv95ToWgs84 } from "../../geo/proj";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const FIRE_DANGER_URL =
  "https://data.geo.admin.ch/ch.bafu.gefahren-waldbrand_warnung/gefahren-waldbrand_warnung/gefahren-waldbrand_warnung_2056.geojson";

type Ring = [number, number][];
interface FireFeature {
  properties: {
    region_id?: number;
    canton?: string;
    level?: number;
    name_de?: string;
    name_fr?: string;
    name_it?: string;
    name_en?: string;
    valid_from?: string;
  };
  geometry:
    { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
}
export interface FireGeoJson {
  type: "FeatureCollection";
  features: FireFeature[];
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const reproject = (ring: Ring): Ring =>
  ring.map(([e, n]) => lv95ToWgs84([e, n]).map(round) as [number, number]);

export function parseFireDanger(json: FireGeoJson): {
  regions: DangerRegion[];
  geojson: unknown;
  issuedAt: string | undefined;
} {
  const regions: DangerRegion[] = [];
  const features: unknown[] = [];
  let issuedAt: string | undefined;
  for (const f of json.features) {
    const p = f.properties;
    const level = Number(p.level);
    if (!Number.isFinite(level) || level < 1 || level > 5) continue;
    const id = String(p.region_id ?? regions.length);
    const region: DangerRegion = { id, name: { de: p.name_de ?? id }, level };
    if (p.name_fr) region.name.fr = p.name_fr;
    if (p.name_it) region.name.it = p.name_it;
    if (p.name_en) region.name.en = p.name_en;
    const canton = CantonCode.safeParse(p.canton);
    if (canton.success) region.canton = canton.data;
    if (p.valid_from && !Number.isNaN(Date.parse(p.valid_from))) {
      region.validFrom = new Date(p.valid_from).toISOString();
      if (!issuedAt || region.validFrom > issuedAt) issuedAt = region.validFrom;
    }
    regions.push(region);
    const geometry =
      f.geometry.type === "Polygon"
        ? { type: "Polygon", coordinates: f.geometry.coordinates.map(reproject) }
        : {
            type: "MultiPolygon",
            coordinates: f.geometry.coordinates.map((poly) => poly.map(reproject)),
          };
    features.push({
      type: "Feature",
      id,
      properties: { id, level, name: region.name.de, canton: region.canton },
      geometry,
    });
  }
  return { regions, geojson: { type: "FeatureCollection", features }, issuedAt };
}

export async function fetchFireDanger(fetchFn: typeof fetch = fetch) {
  const res = await fetchFn(FIRE_DANGER_URL, { headers: { "user-agent": SWISS_NOW_USER_AGENT } });
  if (!res.ok) throw new Error(`bafu fire ${res.status}`);
  return parseFireDanger((await res.json()) as FireGeoJson);
}
