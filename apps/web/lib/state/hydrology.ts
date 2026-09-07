import { loadHydrologyState } from "@swiss-now/core/data-sources/hydrology";
import type { HydrologyState } from "@swiss-now/core";
import { getSource, ttlForCadence } from "@swiss-now/core";

export const HYDROLOGY_TTL_SECONDS = ttlForCadence(getSource("bafu-lindas-hydro").cadenceSeconds);

/** Mode 1 pull-through for the BAFU LINDAS endpoint (one SPARQL POST per 10 minutes). */
export async function getHydrologyState(): Promise<HydrologyState> {
  const cachedFetch: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      next: { revalidate: HYDROLOGY_TTL_SECONDS, tags: ["state:hydrology"] },
    });
  return loadHydrologyState({ fetch: cachedFetch });
}
