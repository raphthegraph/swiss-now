import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEventsState } from "@swiss-now/core/data-sources/news";
import { GeoRegister, type EventsState } from "@swiss-now/core/state";

export const EVENTS_TTL_SECONDS = 300;
const GEO_DIR = process.env["GEO_DIR"] ?? join(process.cwd(), "public", "geo");
let registerPromise: Promise<GeoRegister> | undefined;

/** The municipality register (names + centroids) read once per instance. */
function register(): Promise<GeoRegister> {
  registerPromise ??= readFile(join(GEO_DIR, "municipalities-2026.json"), "utf8").then((s) =>
    GeoRegister.parse(JSON.parse(s)),
  );
  return registerPromise;
}

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
