import { loadSeismicState } from "@swiss-now/core/data-sources/earthquakes";
import type { SeismicState } from "@swiss-now/core";

/** The reviewed catalogue changes rarely; 2 minutes keeps a new felt quake visible quickly enough. */
export const SEISMIC_TTL_SECONDS = 120;

export async function getSeismicState(): Promise<SeismicState> {
  const cachedFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, next: { revalidate: SEISMIC_TTL_SECONDS, tags: ["state:seismic"] } });
  return loadSeismicState(cachedFetch);
}
