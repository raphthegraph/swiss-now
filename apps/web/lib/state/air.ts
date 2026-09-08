import { fetchUgzTail, parseUgzTail } from "@swiss-now/core/data-sources/ugz-air";
import { fetchSensorCommunity } from "@swiss-now/core/data-sources/sensor-community";
import { fetchPollen } from "@swiss-now/core/data-sources/meteoswiss/pollen";
import { buildAirState } from "@swiss-now/core/data-sources/air";
import type { AirState } from "@swiss-now/core/state";

export const AIR_TTL_SECONDS = 300;
const cached =
  (revalidate: number, tag: string) =>
  (url: string, init?: RequestInit): Promise<Response> =>
    fetch(url, { ...init, next: { revalidate, tags: [tag] } });

/** Zürich hourly (published 30 min after the hour), citizen sensors and pollen every 5 minutes. */
export async function getAirState(now = new Date()): Promise<AirState> {
  const [ugz, sc, pollen] = await Promise.allSettled([
    fetchUgzTail(cached(600, "state:air-ugz") as typeof fetch, now).then(parseUgzTail),
    fetchSensorCommunity(cached(AIR_TTL_SECONDS, "state:air-sc") as typeof fetch),
    fetchPollen(cached(AIR_TTL_SECONDS, "state:air-pollen") as typeof fetch),
  ]);
  const ok = <T>(r: PromiseSettledResult<T>): T | undefined =>
    r.status === "fulfilled" ? r.value : undefined;
  return buildAirState({ reference: ok(ugz), citizen: ok(sc), pollen: ok(pollen) }, now);
}
