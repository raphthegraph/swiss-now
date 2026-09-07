import { WEATHER_LAYERS_MVP, loadWeatherState } from "@swiss-now/core/data-sources/geoadmin";
import type { WeatherState } from "@swiss-now/core";
import { getSource, ttlForCadence } from "@swiss-now/core";

/** Cadence-derived TTLs: the upstream files refresh every 5 minutes. */
export const WEATHER_TTL_SECONDS = ttlForCadence(getSource("geoadmin-messwerte").cadenceSeconds);

/**
 * Mode 1 pull-through (docs/ARCHITECTURE.md §2.1).
 * The Next.js Data Cache coalesces every concurrent request into one upstream fetch per TTL;
 * the CDN headers set by the route handler keep most requests from reaching this code at all.
 */
export async function getWeatherState(): Promise<WeatherState> {
  const cachedFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, next: { revalidate: WEATHER_TTL_SECONDS, tags: ["state:weather"] } });
  return loadWeatherState(WEATHER_LAYERS_MVP, { fetch: cachedFetch });
}

export function cacheControl(ttlSeconds: number): string {
  return `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 5}`;
}
