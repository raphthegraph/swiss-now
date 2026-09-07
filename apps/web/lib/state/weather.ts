import { WEATHER_LAYERS_MVP, loadWeatherState } from "@swiss-now/core/data-sources/geoadmin";
import type { WeatherState } from "@swiss-now/core";
import { getSource, ttlForCadence } from "@swiss-now/core";
import {
  getRadarFrames,
  getRadarGrid,
  radarFrameToField,
  rainingShareOfSwitzerland,
} from "./radar";

/** Cadence-derived TTLs: the upstream files refresh every 5 minutes. */
export const WEATHER_TTL_SECONDS = ttlForCadence(getSource("geoadmin-messwerte").cadenceSeconds);

/**
 * Mode 1 pull-through (docs/ARCHITECTURE.md §2.1).
 * The Next.js Data Cache coalesces every concurrent request into one upstream fetch per TTL;
 * the CDN headers set by the route handler keep most requests from reaching this code at all.
 * Radar frames are attached as Fields; a failing radar never fails the weather state.
 */
export async function getWeatherState(): Promise<WeatherState> {
  const cachedFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, next: { revalidate: WEATHER_TTL_SECONDS, tags: ["state:weather"] } });

  const [state, radar] = await Promise.all([
    loadWeatherState(WEATHER_LAYERS_MVP, { fetch: cachedFetch }),
    getRadarFrames().catch(() => []),
  ]);

  if (radar.length > 0) {
    state.fields = radar.map(radarFrameToField);
    state.sources = [...new Set([...state.sources, "meteoswiss-radar" as const])];
    try {
      const latest = await getRadarGrid(radar[0]!.id);
      if (latest) state.rainingAreaShare = rainingShareOfSwitzerland(latest);
    } catch {
      // area share is a nicety; the frame list is still served
    }
  }
  return state;
}

export function cacheControl(ttlSeconds: number): string {
  return `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 5}`;
}
