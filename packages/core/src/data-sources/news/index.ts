/** Events pipeline: feeds → items → category → place → dedupe → EventsState. */
import { createHash } from "node:crypto";
import type { EventsState, NewsEvent } from "../../state/events";
import type { GeoRegister } from "../../state/geo";
import type { SourceId } from "../../sources/ids";
import { computeFreshness } from "../../freshness/index";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";
import { parseRss, type RawItem } from "./rss";
import { categorize } from "./categories";
import {
  buildGeocodeIndex,
  gazetteerUrl,
  geocodeWithRegister,
  parseGazetteer,
  type GeocodeIndex,
} from "./geocode";
import { dedupe } from "./dedupe";

export * from "./rss";
export * from "./categories";
export * from "./geocode";
export * from "./dedupe";

export const FEEDS: { source: SourceId; url: string; fallback: "police" | "news" }[] = [
  { source: "polizei-news", url: "https://polizei.news/feed/", fallback: "police" },
  { source: "srf-rss", url: "https://www.srf.ch/news/bnf/rss/1890", fallback: "news" },
];

/** Items the police feed carries about Germany/Austria are recognisable by their categories. */
function isForeign(item: RawItem): boolean {
  return item.categories.some((c) =>
    /^(deutschland|österreich|#eilmeldungen (de|at))$/i.test(c.trim()),
  );
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface LoadEventsOptions {
  fetch?: FetchLike;
  register: GeoRegister;
  now?: Date;
  windowHours?: number;
  /** max gazetteer lookups per refresh (each is one upstream request, cached by the caller's fetch) */
  gazetteerBudget?: number;
}

export function itemsToEvents(
  items: RawItem[],
  idx: GeocodeIndex,
  fallbackFor: (s: SourceId) => "police" | "news",
) {
  const events: {
    event: NewsEvent;
    gazetteerQuery?: string;
    cantonHint?: NewsEvent["place"] extends infer P
      ? P extends { cantonCode?: infer C }
        ? C
        : never
      : never;
  }[] = [];
  for (const it of items) {
    if (isForeign(it)) continue;
    const geo = geocodeWithRegister(it.title, it.categories, idx);
    const event: NewsEvent = {
      id: `${it.source}:${createHash("sha1").update(it.url).digest("hex").slice(0, 12)}`,
      publishedAt: it.publishedAt,
      source: it.source,
      category: categorize(it.title, it.categories, fallbackFor(it.source)),
      headline: { de: it.title },
      url: it.url,
    };
    if (geo.place) event.place = geo.place;
    const entry: (typeof events)[number] = { event };
    if (geo.gazetteerQuery) entry.gazetteerQuery = geo.gazetteerQuery;
    if (geo.cantonHint) entry.cantonHint = geo.cantonHint;
    events.push(entry);
  }
  return events;
}

export async function loadEventsState(opts: LoadEventsOptions): Promise<EventsState> {
  const fetchFn = opts.fetch ?? fetch;
  const now = opts.now ?? new Date();
  const windowHours = opts.windowHours ?? 24;
  const idx = buildGeocodeIndex(opts.register);
  const headers = {
    "user-agent": SWISS_NOW_USER_AGENT,
    accept: "application/rss+xml, application/xml",
  };
  const settled = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const res = await fetchFn(f.url, { headers });
      if (!res.ok) throw new Error(`${f.source} ${res.status}`);
      return parseRss(await res.text(), f.source);
    }),
  );
  const items = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const sources = FEEDS.filter((_, i) => settled[i]!.status === "fulfilled").map((f) => f.source);
  const fallbackFor = (s: SourceId) => FEEDS.find((f) => f.source === s)?.fallback ?? "news";
  const entries = itemsToEvents(items, idx, fallbackFor);
  // gazetteer for police headlines whose place is not a municipality (hamlets, passes, lakes)
  let budget = opts.gazetteerBudget ?? 20;
  for (const e of entries) {
    if (e.event.place || !e.gazetteerQuery || budget <= 0) continue;
    budget--;
    try {
      const res = await fetchFn(gazetteerUrl(e.gazetteerQuery), {
        headers: { "user-agent": SWISS_NOW_USER_AGENT },
      });
      if (!res.ok) continue;
      const p = parseGazetteer(
        (await res.json()) as Parameters<typeof parseGazetteer>[0],
        e.gazetteerQuery,
        e.cantonHint,
      );
      if (p) e.event.place = p;
    } catch {
      // stays unplaced
    }
  }
  const cutoff = now.getTime() - windowHours * 3_600_000;
  const events = dedupe(entries.map((e) => e.event)).filter(
    (e) => new Date(e.publishedAt).getTime() >= cutoff,
  );
  const latest = events[0]?.publishedAt;
  return {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    observedAt: latest ?? now.toISOString(),
    // feeds update continuously; an hour without a new item is normal, a day is not
    freshness: sources.length ? computeFreshness(latest, 3 * 3600, 0, now) : "outage",
    sources: sources.length ? sources : ["polizei-news"],
    events,
    windowHours,
  };
}
