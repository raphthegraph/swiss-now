import { loadEventsState } from "@swiss-now/core/data-sources/news";
import type { EventsState } from "@swiss-now/core/state";
import { getRegister } from "./geo";

export const EVENTS_TTL_SECONDS = 300;
const register = getRegister;

/** Police and SRF headlines, geocoded; feeds every 5 minutes, gazetteer lookups cached a month. */
export async function getEventsState(now = new Date()): Promise<EventsState> {
  const reg = await register();
  const fetchFn = (url: string, init?: RequestInit) =>
    fetch(url, {
      ...init,
      next: /SearchServer/.test(url)
        ? { revalidate: 30 * 86_400, tags: ["geocode"] }
        : { revalidate: EVENTS_TTL_SECONDS, tags: ["state:events"] },
    });
  return loadEventsState({
    fetch: fetchFn,
    register: reg,
    now,
    windowHours: 24,
    gazetteerBudget: 20,
  });
}
