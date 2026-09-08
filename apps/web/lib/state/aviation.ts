import { fetchAviation } from "@swiss-now/core/data-sources/adsb-fi";
import { policyFromEnv, sourceAccess } from "@swiss-now/core/sources";
import type { AviationState } from "@swiss-now/core/state";

export const AVIATION_TTL_SECONDS = 10;

/** Blocked by the licence policy unless SWISS_NOW_ALLOW=adsb-fi is set for a local run. */
export function aviationAccess() {
  return sourceAccess("adsb-fi", policyFromEnv(process.env));
}

export async function getAviationState(now = new Date()): Promise<AviationState> {
  const fetchFn = (url: string, init?: RequestInit) =>
    fetch(url, { ...init, next: { revalidate: AVIATION_TTL_SECONDS, tags: ["state:aviation"] } });
  return fetchAviation(fetchFn as typeof fetch, now);
}
