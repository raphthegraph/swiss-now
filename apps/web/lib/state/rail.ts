import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Event, RailState } from "@swiss-now/core";
import {
  buildStationIndex,
  fetchSbbDisruptions,
  sbbRecordsToEvents,
} from "@swiss-now/core/data-sources/transit";
import {
  buildRailState,
  fetchTripUpdates,
  serviceWindow,
  type RailDayFile,
  type RailDistancesFile,
  type RailMeta,
  type RailPatternsFile,
  type RailRoutesFile,
  type RailStopsFile,
  type TripUpdatesFeed,
} from "@swiss-now/core/data-sources/transit";

/** Realtime feed cadence; the platform caches 30 s and allows 2–5 requests per minute. */
export const RAIL_TTL_SECONDS = 60;
/** Where the GTFS build wrote its files (docs/ARCHITECTURE.md §2.2). Vercel Blob later. */
const RAIL_DIR = process.env["RAIL_DATA_DIR"] ?? join(process.cwd(), "public", "rail");
/** Where the browser fetches single paths: next to the rail files when they come from a public URL. */
const PATHS_URL = process.env["RAIL_DATA_URL"]
  ? `${process.env["RAIL_DATA_URL"].replace(/\/$/, "")}/paths`
  : "/rail/paths";

// Module-level caches survive across warm invocations of the same function instance.
const fileCache = new Map<string, { mtime: number; value: unknown }>();
let feedCache: { at: number; feed: TripUpdatesFeed } | undefined;
let feedInFlight: Promise<TripUpdatesFeed> | undefined;

/** Reads a rail file by relative name; the single dynamic argument keeps the bundler's file tracer from globbing 18 k paths. */
export async function readRailJson<T>(name: string): Promise<T> {
  return readJson<T>(name);
}

/** When set (e.g. a Vercel Blob base URL), rail files are fetched over HTTP instead of the local dir. */
const RAIL_URL = process.env["RAIL_DATA_URL"]?.replace(/\/$/, "");

async function readJson<T>(name: string): Promise<T> {
  const key = RAIL_URL ? `${RAIL_URL}/${name}` : join(RAIL_DIR, name);
  const cached = fileCache.get(key);
  const now = Date.now();
  if (cached && now - cached.mtime < 5 * 60_000) return cached.value as T;
  let value: T;
  if (RAIL_URL) {
    const res = await fetch(key, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`rail file ${name}: ${res.status}`);
    value = (await res.json()) as T;
  } else {
    value = JSON.parse(await readFile(key, "utf8")) as T;
  }
  fileCache.set(key, { mtime: now, value });
  return value;
}

async function getFeed(): Promise<TripUpdatesFeed | undefined> {
  const key = process.env["OTD_API_KEY"];
  if (!key) return undefined;
  const now = Date.now();
  if (feedCache && now - feedCache.at < RAIL_TTL_SECONDS * 1000) return feedCache.feed;
  if (!feedInFlight) {
    feedInFlight = fetchTripUpdates(key)
      .then((feed) => {
        feedCache = { at: Date.now(), feed };
        return feed;
      })
      .finally(() => {
        feedInFlight = undefined;
      });
  }
  try {
    return await feedInFlight;
  } catch {
    return feedCache?.feed; // stale feed beats no feed; freshness will say so
  }
}

/** Stop ids inside the Swiss bounding box (foreign legs of international trains stay; wholly foreign trips go). */
async function getSwissStops(): Promise<Set<string>> {
  const stops = await readJson<RailStopsFile>("stops.json");
  const set = new Set<string>();
  for (const [id, [lon, lat]] of Object.entries(stops)) {
    if (lon > 5.9 && lon < 10.6 && lat > 45.7 && lat < 47.9) set.add(id);
  }
  return set;
}

/** Service days may overlap around midnight (trips after 24:00 belong to the previous day). */
function serviceDaysFor(now: Date): string[] {
  const [yesterday, today] = serviceWindow(now, 0);
  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  return localHour < 4 && yesterday ? [yesterday, today!] : [today!];
}

export async function getRailState(): Promise<RailState> {
  const now = new Date();
  const [meta, patterns, routes, stopsInSwitzerland, distances, feed] = await Promise.all([
    readJson<RailMeta>("meta.json"),
    readJson<RailPatternsFile>("patterns.json"),
    readJson<RailRoutesFile>("routes.json").catch(() => undefined),
    getSwissStops().catch(() => undefined),
    readJson<RailDistancesFile>("distances.json").catch(() => undefined),
    getFeed(),
  ]);
  const days = await Promise.all(
    serviceDaysFor(now).map((d) => readJson<RailDayFile>(`days/${d}.json`).catch(() => undefined)),
  );
  const states = days
    .filter((d): d is RailDayFile => Boolean(d))
    .map((day) =>
      buildRailState({
        day,
        patterns,
        routes,
        distances,
        feed,
        pathsUrl: PATHS_URL,
        gtfsBuild: meta.feedVersion,
        now,
        stopsInSwitzerland,
      }),
    );
  if (states.length === 0) throw new Error("no service-day file for today — run the GTFS build");
  const merged = states[0]!;
  for (const s of states.slice(1)) merged.activeTrips.push(...s.activeTrips);
  merged.disruptions = await getDisruptions(now);
  if (merged.disruptions.length > 0)
    merged.sources = [...new Set([...merged.sources, "sbb-rail-traffic-info" as const])];
  return merged;
}

/** SBB rail-traffic messages placed between their named stations (5-minute cadence). */
async function getDisruptions(now: Date): Promise<Event[]> {
  try {
    const cachedFetch: typeof fetch = (input, init) =>
      fetch(input, { ...init, next: { revalidate: 300, tags: ["state:rail-disruptions"] } });
    const [records, stops] = await Promise.all([
      fetchSbbDisruptions(cachedFetch, 100),
      readJson<RailStopsFile>("stops.json"),
    ]);
    const index = buildStationIndex(
      Object.entries(stops).map(([, [lon, lat, name]]) => ({
        name,
        lonLat: [lon, lat] as [number, number],
      })),
    );
    return sbbRecordsToEvents(records, index, now);
  } catch {
    return [];
  }
}
