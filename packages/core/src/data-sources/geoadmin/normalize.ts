import type { Observation, Station } from "../../state/entities";
import { looksLikeLv95, lv95ToWgs84 } from "../../geo/proj";
import { GEOADMIN_MEASUREMENT_LAYERS, type GeoAdminMeasurementLayerId } from "./layers";
import type { GeoAdminFeatureCollection } from "./parse";

export interface NormalizedLayer {
  stations: Station[];
  observations: Observation[];
  /** newest `reference_ts` in the layer, or undefined when every value is missing */
  observedAt: string | undefined;
}

/** Station ids are namespaced with the SwissMetNet prefix; codes are the 3-letter MeteoSwiss codes. */
export const stationId = (code: string): string => `smn:${code.toUpperCase()}`;

export function normalizeGeoAdminLayer(
  fc: GeoAdminFeatureCollection,
  layerId: GeoAdminMeasurementLayerId,
): NormalizedLayer {
  const { parameter } = GEOADMIN_MEASUREMENT_LAYERS[layerId];
  const crs = fc.crs?.properties.name ?? "EPSG:2056";
  const stations: Station[] = [];
  const observations: Observation[] = [];
  let newest: string | undefined;

  for (const f of fc.features) {
    const raw = f.geometry.coordinates;
    const lonLat =
      crs === "EPSG:2056" || looksLikeLv95(raw)
        ? lv95ToWgs84(raw)
        : ([raw[0], raw[1]] as [number, number]);
    const id = stationId(f.id);
    const station: Station = {
      id,
      name: { de: f.properties.station_name, en: f.properties.station_name },
      kind: "weather",
      lonLat,
      source: "geoadmin-messwerte",
    };
    if (f.properties.altitude !== undefined && Number.isFinite(f.properties.altitude)) {
      station.elevation = f.properties.altitude;
    }
    stations.push(station);

    const ts = f.properties.reference_ts;
    if (ts === "-" || f.properties.value === null || !Number.isFinite(f.properties.value)) continue;
    observations.push({ stationId: id, parameter, value: f.properties.value, observedAt: ts });
    if (parameter === "windGust" && f.properties.wind_direction !== undefined) {
      observations.push({
        stationId: id,
        parameter: "windDirection",
        value: f.properties.wind_direction,
        observedAt: ts,
      });
    }
    if (newest === undefined || ts > newest) newest = ts;
  }

  return { stations, observations, observedAt: newest };
}
