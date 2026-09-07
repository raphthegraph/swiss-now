import type { HydrologyState } from "../../state/layers";
import { SWISS_NOW_USER_AGENT, UpstreamError } from "../geoadmin/client";
import { buildHydrologyState, normalizeHydroRows } from "./normalize";
import { parseHydroResults, type HydroRow } from "./parse";
import { HYDRO_CURRENT_QUERY, LINDAS_ENDPOINT } from "./query";

export * from "./query";
export * from "./parse";
export * from "./normalize";

export interface HydroFetchOptions {
  fetch?: typeof fetch;
  init?: RequestInit;
}

/** One SPARQL POST → 235 rows (~350 KB JSON). Cached by the caller at the 10-minute cadence. */
export async function fetchHydroRows(opts: HydroFetchOptions = {}): Promise<HydroRow[]> {
  const doFetch = opts.fetch ?? fetch;
  const res = await doFetch(LINDAS_ENDPOINT, {
    ...opts.init,
    method: "POST",
    headers: {
      "User-Agent": SWISS_NOW_USER_AGENT,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
      ...opts.init?.headers,
    },
    body: new URLSearchParams({ query: HYDRO_CURRENT_QUERY }).toString(),
  });
  if (!res.ok)
    throw new UpstreamError(`LINDAS responded ${res.status}`, LINDAS_ENDPOINT, res.status);
  return parseHydroResults(await res.json());
}

export async function loadHydrologyState(opts: HydroFetchOptions = {}): Promise<HydrologyState> {
  return buildHydrologyState(normalizeHydroRows(await fetchHydroRows(opts)));
}
