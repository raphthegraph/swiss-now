import type { Feature, FeatureCollection, Point } from "geojson";
import type { Observation, WeatherState } from "@swiss-now/core";

export interface StationFeatureProps {
  id: string;
  name: string;
  temp?: number;
  gust?: number;
  windDir?: number;
  rain?: number;
  elevation?: number;
  observedAt?: string;
}

/** Latest value per parameter per station, as a GeoJSON FeatureCollection for MapLibre. */
export function stationsToGeoJSON(
  state: WeatherState,
): FeatureCollection<Point, StationFeatureProps> {
  const latest = new Map<string, Map<Observation["parameter"], Observation>>();
  for (const o of state.observations) {
    const perStation = latest.get(o.stationId) ?? new Map<Observation["parameter"], Observation>();
    const prev = perStation.get(o.parameter);
    if (!prev || o.observedAt > prev.observedAt) perStation.set(o.parameter, o);
    latest.set(o.stationId, perStation);
  }
  const features: Feature<Point, StationFeatureProps>[] = [];
  for (const s of state.stations) {
    const obs = latest.get(s.id);
    const props: StationFeatureProps = { id: s.id, name: s.name.en ?? s.name.de };
    if (s.elevation !== undefined) props.elevation = s.elevation;
    const t = obs?.get("airTemperature");
    const g = obs?.get("windGust");
    const d = obs?.get("windDirection");
    const r = obs?.get("precipitation10min");
    if (t) props.temp = t.value;
    if (g) props.gust = g.value;
    if (d) props.windDir = d.value;
    if (r) props.rain = r.value;
    const newest = [t, g, r]
      .filter(Boolean)
      .map((o) => o!.observedAt)
      .sort()
      .at(-1);
    if (newest) props.observedAt = newest;
    features.push({
      type: "Feature",
      id: s.id,
      geometry: { type: "Point", coordinates: s.lonLat },
      properties: props,
    });
  }
  return { type: "FeatureCollection", features };
}
