import { fetchFrequency, fetchImportExport } from "@swiss-now/core/data-sources/swissgrid";
import { fetchPriceCurrent, fetchPublicPower } from "@swiss-now/core/data-sources/energy-charts";
import { buildEnergyState } from "@swiss-now/core/data-sources/energy";
import { fetchReservoirs } from "@swiss-now/core/data-sources/sfoe-reservoirs";
import type { EnergyState } from "@swiss-now/core/state";

export const ENERGY_TTL_SECONDS = 60;
/** Energy-Charts allows 2 requests per minute: one fetch per quarter hour through the Data Cache. */
const MIX_TTL_SECONDS = 900;
/** The storage-lake file changes once a week. */
const RESERVOIR_TTL_SECONDS = 6 * 3600;

const cached =
  (revalidate: number, tag: string) =>
  (url: string, init?: RequestInit): Promise<Response> =>
    fetch(url, { ...init, next: { revalidate, tags: [tag] } });

/** Swissgrid flows and frequency each minute; the mix and the price every 15 minutes. */
export async function getEnergyState(now = new Date()): Promise<EnergyState> {
  const live = cached(ENERGY_TTL_SECONDS, "state:energy");
  const slow = cached(MIX_TTL_SECONDS, "state:energy-mix");
  // the mix window is rounded to the quarter hour so the cached URL repeats
  const mixNow = new Date(
    Math.floor(now.getTime() / (MIX_TTL_SECONDS * 1000)) * MIX_TTL_SECONDS * 1000,
  );
  const weekly = cached(RESERVOIR_TTL_SECONDS, "state:energy-reservoirs");
  const [flows, frequency, generation, price, reservoir] = await Promise.allSettled([
    fetchImportExport(live as typeof fetch),
    fetchFrequency(live as typeof fetch),
    fetchPublicPower(slow as typeof fetch, mixNow),
    fetchPriceCurrent(slow as typeof fetch),
    fetchReservoirs(weekly as typeof fetch),
  ]);
  const ok = <T>(r: PromiseSettledResult<T>): T | undefined =>
    r.status === "fulfilled" ? r.value : undefined;
  return buildEnergyState(
    {
      flows: ok(flows),
      frequency: ok(frequency),
      generation: ok(generation),
      price: ok(price),
      reservoir: ok(reservoir),
    },
    now,
  );
}
