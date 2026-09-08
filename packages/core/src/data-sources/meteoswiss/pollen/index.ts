/** MeteoSwiss hourly pollen layers on geo.admin (same GeoJSON shape as the weather layers, EPSG:2056). */
import type { Observation, Parameter, Station } from "../../../state/entities";
import { lv95ToWgs84, looksLikeLv95 } from "../../../geo/proj";
import { parseGeoAdminLayer } from "../../geoadmin/parse";
import { SWISS_NOW_USER_AGENT } from "../../geoadmin/client";

export const POLLEN_LAYERS: Record<string, Parameter> = {
  "ch.meteoschweiz.messwerte-pollen-graeser-1h": "pollenGrasses",
  "ch.meteoschweiz.messwerte-pollen-birke-1h": "pollenBirch",
  "ch.meteoschweiz.messwerte-pollen-hasel-1h": "pollenHazel",
  "ch.meteoschweiz.messwerte-pollen-erle-1h": "pollenAlder",
  "ch.meteoschweiz.messwerte-pollen-esche-1h": "pollenAsh",
  "ch.meteoschweiz.messwerte-pollen-buche-1h": "pollenBeech",
  "ch.meteoschweiz.messwerte-pollen-eiche-1h": "pollenOak",
};
export const pollenLayerUrl = (layer: string) =>
  `https://data.geo.admin.ch/${layer}/${layer}_de.json`;
export const pollenStationId = (id: string) => `pollen:${id}`;

export function parsePollenLayer(
  json: unknown,
  parameter: Parameter,
): { stations: Station[]; observations: Observation[] } {
  const fc = parseGeoAdminLayer(json);
  const stations: Station[] = [];
  const observations: Observation[] = [];
  for (const f of fc.features) {
    const raw = f.geometry.coordinates;
    const lonLat = looksLikeLv95(raw) ? lv95ToWgs84(raw) : ([raw[0], raw[1]] as [number, number]);
    const id = pollenStationId(f.id);
    const st: Station = {
      id,
      name: { de: f.properties.station_name, en: f.properties.station_name },
      kind: "air",
      tier: "reference",
      lonLat,
      source: "meteoswiss-pollen",
    };
    if (f.properties.altitude !== undefined && Number.isFinite(f.properties.altitude))
      st.elevation = f.properties.altitude;
    stations.push(st);
    const ts = f.properties.reference_ts;
    if (ts === "-" || f.properties.value === null || !Number.isFinite(f.properties.value)) continue;
    observations.push({ stationId: id, parameter, value: f.properties.value, observedAt: ts });
  }
  return { stations, observations };
}

export async function fetchPollen(fetchFn: typeof fetch = fetch) {
  const results = await Promise.allSettled(
    Object.entries(POLLEN_LAYERS).map(async ([layer, parameter]) => {
      const res = await fetchFn(pollenLayerUrl(layer), {
        headers: { "user-agent": SWISS_NOW_USER_AGENT },
      });
      if (!res.ok) throw new Error(`pollen ${layer} ${res.status}`);
      return parsePollenLayer(await res.json(), parameter);
    }),
  );
  const stations = new Map<string, Station>();
  const observations: Observation[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const s of r.value.stations) stations.set(s.id, s);
    observations.push(...r.value.observations);
  }
  return { stations: [...stations.values()], observations };
}
