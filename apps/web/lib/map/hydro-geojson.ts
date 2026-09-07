import type { Feature, FeatureCollection, Point } from "geojson";
import type { HydrologyState, Observation } from "@swiss-now/core";

export interface HydroFeatureProps {
  id: string;
  name: string;
  waterBody?: string;
  kind: "hydro-river" | "hydro-lake";
  level?: number;
  discharge?: number;
  temp?: number;
  danger: number; // 0 = not classified
  observedAt?: string;
}

export function hydroToGeoJSON(state: HydrologyState): FeatureCollection<Point, HydroFeatureProps> {
  const latest = new Map<string, Map<Observation["parameter"], Observation>>();
  for (const o of state.observations) {
    const m = latest.get(o.stationId) ?? new Map<Observation["parameter"], Observation>();
    if (!m.has(o.parameter) || o.observedAt > m.get(o.parameter)!.observedAt) m.set(o.parameter, o);
    latest.set(o.stationId, m);
  }
  const features: Feature<Point, HydroFeatureProps>[] = [];
  for (const s of state.stations) {
    const m = latest.get(s.id);
    const props: HydroFeatureProps = {
      id: s.id,
      name: s.name.de,
      kind: s.kind === "hydro-lake" ? "hydro-lake" : "hydro-river",
      danger: state.dangerLevels[s.id] ?? 0,
    };
    if (s.waterBody) props.waterBody = s.waterBody;
    const l = m?.get("waterLevel");
    const q = m?.get("discharge");
    const t = m?.get("waterTemperature");
    if (l) props.level = l.value;
    if (q) props.discharge = q.value;
    if (t) props.temp = t.value;
    const newest = [l, q, t]
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

/**
 * River width classes from the largest current discharge measured on each named water body, so
 * the basemap's `waterway` lines can be drawn thicker where more water flows right now.
 * Returns a MapLibre `match` expression on the tile's `name` field.
 */
export function riverWidthExpression(state: HydrologyState): unknown[] {
  const maxByBody = new Map<string, number>();
  const bodyByStation = new Map(state.stations.map((s) => [s.id, s.waterBody] as const));
  for (const o of state.observations) {
    if (o.parameter !== "discharge") continue;
    const body = bodyByStation.get(o.stationId);
    if (!body) continue;
    maxByBody.set(body, Math.max(maxByBody.get(body) ?? 0, o.value));
  }
  const pairs: unknown[] = [];
  for (const [body, q] of maxByBody) {
    // 1 m³/s → 0.6 px … 1000 m³/s → 3 px (log scale)
    const w = Math.max(0.6, Math.min(3.2, 0.6 + Math.log10(Math.max(1, q)) * 0.85));
    pairs.push(body, Math.round(w * 100) / 100);
  }
  if (pairs.length === 0) return ["literal", 0.8];
  return ["match", ["coalesce", ["get", "name:de"], ["get", "name"]], ...pairs, 0.7];
}
