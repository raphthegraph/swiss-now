import type { HydrologyState, LonLat, Observation, WeatherState } from "@swiss-now/core";
import { haversineMeters } from "@swiss-now/motion/math";

export interface LocalSummary {
  stationName: string;
  distanceKm: number;
  temperature?: number;
  gustKmh?: number;
  rain10min?: number;
  observedAt?: string;
  river?: {
    name: string;
    waterBody?: string;
    discharge?: number;
    level?: number;
    temp?: number;
    danger?: number;
  };
}

function latestByParam(observations: Observation[], stationId: string) {
  const m = new Map<Observation["parameter"], Observation>();
  for (const o of observations) {
    if (o.stationId !== stationId) continue;
    const prev = m.get(o.parameter);
    if (!prev || o.observedAt > prev.observedAt) m.set(o.parameter, o);
  }
  return m;
}

/** What the home place feels like right now: nearest weather station with a temperature, nearest river station. */
export function localSummary(
  lonLat: LonLat,
  weather: WeatherState,
  hydrology?: HydrologyState,
): LocalSummary | undefined {
  const withTemp = new Set(
    weather.observations.filter((o) => o.parameter === "airTemperature").map((o) => o.stationId),
  );
  let best: { id: string; name: string; d: number } | undefined;
  for (const s of weather.stations) {
    if (!withTemp.has(s.id)) continue;
    const d = haversineMeters(lonLat, s.lonLat);
    if (!best || d < best.d) best = { id: s.id, name: s.name.en ?? s.name.de, d };
  }
  if (!best) return undefined;
  const obs = latestByParam(weather.observations, best.id);
  const out: LocalSummary = { stationName: best.name, distanceKm: Math.round(best.d / 100) / 10 };
  const t = obs.get("airTemperature");
  const g = obs.get("windGust");
  const r = obs.get("precipitation10min");
  if (t) {
    out.temperature = t.value;
    out.observedAt = t.observedAt;
  }
  if (g) out.gustKmh = g.value;
  if (r) out.rain10min = r.value;

  if (hydrology) {
    let river: { id: string; name: string; waterBody?: string; d: number } | undefined;
    for (const s of hydrology.stations) {
      if (s.kind !== "hydro-river") continue;
      const d = haversineMeters(lonLat, s.lonLat);
      if (d < 25_000 && (!river || d < river.d)) {
        river = { id: s.id, name: s.name.de, d };
        if (s.waterBody) river.waterBody = s.waterBody;
      }
    }
    if (river) {
      const h = latestByParam(hydrology.observations, river.id);
      const entry: LocalSummary["river"] = { name: river.name };
      if (river.waterBody) entry.waterBody = river.waterBody;
      const q = h.get("discharge");
      const l = h.get("waterLevel");
      const wt = h.get("waterTemperature");
      if (q) entry.discharge = q.value;
      if (l) entry.level = l.value;
      if (wt) entry.temp = wt.value;
      const danger = hydrology.dangerLevels[river.id];
      if (danger) entry.danger = danger;
      out.river = entry;
    }
  }
  return out;
}
