import type { Observation, Station } from "../../state/entities";
import type { Extreme, WeatherExtremes, WeatherState } from "../../state/layers";
import { SCHEMA_VERSION } from "../../state/common";
import { freshnessForSource } from "../../freshness/index";
import { fetchGeoAdminLayer, type FetchOptions } from "./client";
import { WEATHER_LAYERS_MVP, type GeoAdminMeasurementLayerId } from "./layers";
import { normalizeGeoAdminLayer, type NormalizedLayer } from "./normalize";

export * from "./layers";
export * from "./parse";
export * from "./normalize";
export * from "./client";

/** Merges normalized layers into a WeatherState. Pure; testable without network. */
export function buildWeatherState(layers: NormalizedLayer[], now: Date = new Date()): WeatherState {
  const stationsById = new Map<string, Station>();
  const observations: Observation[] = [];
  let observedAt: string | undefined;

  for (const layer of layers) {
    for (const s of layer.stations) {
      const existing = stationsById.get(s.id);
      if (!existing) stationsById.set(s.id, s);
      else if (existing.elevation === undefined && s.elevation !== undefined)
        existing.elevation = s.elevation;
    }
    observations.push(...layer.observations);
    if (layer.observedAt && (observedAt === undefined || layer.observedAt > observedAt)) {
      observedAt = layer.observedAt;
    }
  }

  const freshness = freshnessForSource("geoadmin-messwerte", observedAt, now);
  const fallbackTs = now.toISOString();

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: fallbackTs,
    observedAt: observedAt ?? fallbackTs,
    freshness,
    sources: ["geoadmin-messwerte"],
    stations: [...stationsById.values()],
    observations,
    fields: [],
    extremes: computeExtremes(observations),
    ...rainingShare(observations),
  };
}

function rainingShare(observations: Observation[]): { rainingShare?: number } {
  const rain = observations.filter((o) => o.parameter === "precipitation10min");
  if (rain.length === 0) return {};
  return { rainingShare: rain.filter((o) => o.value > 0).length / rain.length };
}

export function computeExtremes(observations: Observation[]): WeatherExtremes {
  const pick = (
    param: Observation["parameter"],
    cmp: (a: number, b: number) => boolean,
  ): Extreme | undefined => {
    let best: Observation | undefined;
    for (const o of observations) {
      if (o.parameter !== param) continue;
      if (!best || cmp(o.value, best.value)) best = o;
    }
    return best
      ? { stationId: best.stationId, value: best.value, observedAt: best.observedAt }
      : undefined;
  };
  const extremes: WeatherExtremes = {};
  const warmest = pick("airTemperature", (a, b) => a > b);
  const coldest = pick("airTemperature", (a, b) => a < b);
  const gust = pick("windGust", (a, b) => a > b);
  const wet1h = pick("precipitation1h", (a, b) => a > b);
  const wet24h = pick("precipitation24h", (a, b) => a > b);
  const snow = pick("snowDepth", (a, b) => a > b);
  if (warmest) extremes.warmest = warmest;
  if (coldest) extremes.coldest = coldest;
  if (gust && gust.value > 0) extremes.windiestGust = gust;
  if (wet1h && wet1h.value > 0) extremes.wettest1h = wet1h;
  if (wet24h && wet24h.value > 0) extremes.wettest24h = wet24h;
  if (snow && snow.value > 0) extremes.deepestSnow = snow;
  return extremes;
}

/** Fetches and normalizes the given layers (defaults to the MVP set). Network I/O lives only here. */
export async function loadWeatherState(
  layerIds: GeoAdminMeasurementLayerId[] = WEATHER_LAYERS_MVP,
  opts: FetchOptions = {},
): Promise<WeatherState> {
  const results = await Promise.allSettled(
    layerIds.map(async (id) => normalizeGeoAdminLayer(await fetchGeoAdminLayer(id, opts), id)),
  );
  const ok = results.filter(
    (r): r is PromiseFulfilledResult<NormalizedLayer> => r.status === "fulfilled",
  );
  if (ok.length === 0) {
    const first = results[0];
    throw first && first.status === "rejected" ? first.reason : new Error("no layers loaded");
  }
  return buildWeatherState(ok.map((r) => r.value));
}
