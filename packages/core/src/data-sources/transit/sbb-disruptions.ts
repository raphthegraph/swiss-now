/**
 * SBB "Rail traffic information" (data.sbb.ch, Opendatasoft, refreshed every 5 minutes, no key,
 * terms-by incl. commercial). Verified 2026-09-08: fields title, description, published, cause,
 * startdatetime, enddatetime, dailyvaliditybegin/end, type, author, link, description_html.
 * Titles read "Limited service: Vauderens - Romont FR" / "Line interrupted: X - Y" /
 * "Service resumed: X - Y". There is no geometry: station names are matched against the rail stops.
 */
import { z } from "zod";
import type { Event } from "../../state/entities";
import type { LonLat } from "../../state/common";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const SBB_RTI_URL =
  "https://data.sbb.ch/api/explore/v2.1/catalog/datasets/rail-traffic-information/records";

const Record = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  published: z.string().nullable().optional(),
  cause: z.string().nullable().optional(),
  startdatetime: z.string().nullable().optional(),
  enddatetime: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
});
const Page = z.object({ total_count: z.number(), results: z.array(Record) });
export type SbbRecord = z.infer<typeof Record>;

export async function fetchSbbDisruptions(
  doFetch: typeof fetch = fetch,
  limit = 100,
): Promise<SbbRecord[]> {
  const url = `${SBB_RTI_URL}?limit=${limit}&order_by=published%20desc`;
  const res = await doFetch(url, {
    headers: { "User-Agent": SWISS_NOW_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`data.sbb.ch responded ${res.status}`);
  return Page.parse(await res.json()).results;
}

/** Station name normalisation for matching: lower-case, no accents, no punctuation, no parentheticals. */
export function normalizeStationName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface StationIndex {
  byName: Map<string, LonLat>;
}

export function buildStationIndex(stops: Iterable<{ name: string; lonLat: LonLat }>): StationIndex {
  const byName = new Map<string, LonLat>();
  for (const s of stops) {
    const key = normalizeStationName(s.name);
    if (key && !byName.has(key)) byName.set(key, s.lonLat);
  }
  return { byName };
}

function lookup(index: StationIndex, name: string): LonLat | undefined {
  const key = normalizeStationName(name);
  if (index.byName.has(key)) return index.byName.get(key);
  // "Fribourg/Freiburg" → first variant; "Romont FR" → drop canton suffix
  const first = key.split("/")[0]?.trim();
  if (first && index.byName.has(first)) return index.byName.get(first);
  const noCanton = key.replace(
    /\s(ag|ai|ar|be|bl|bs|fr|ge|gl|gr|ju|lu|ne|nw|ow|sg|sh|so|sz|tg|ti|ur|vd|vs|zg|zh)$/,
    "",
  );
  if (index.byName.has(noCanton)) return index.byName.get(noCanton);
  for (const [k, v] of index.byName) if (k.startsWith(key + " ")) return v;
  return undefined;
}

/** Splits "Limited service: Vauderens - Romont FR" into kind and station names. */
export function parseTitle(title: string): { kind: string; stations: string[] } {
  const [kindPart, rest] = title.includes(":")
    ? [title.slice(0, title.indexOf(":")), title.slice(title.indexOf(":") + 1)]
    : ["", title];
  const stations = rest
    .split(/\s[-–]\s|\s-\s|\s–\s/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { kind: kindPart.trim().toLowerCase(), stations };
}

const SEVERITY: Array<[RegExp, 1 | 2 | 3 | 4 | 5]> = [
  [/interrupt|unterbr|interrompu|interrotta|closed|gesperrt/i, 4],
  [/limited|eingeschr|limit|ridott|disruption|störung|perturbation/i, 3],
  [/delay|verspät|retard|ritard/i, 2],
];

/**
 * Active or upcoming disruptions as Events with a line between the named stations (or a point).
 * "Service resumed" messages are informational and dropped; unmatched stations produce no geometry
 * and are dropped too — better no marker than a wrong one.
 */
export function sbbRecordsToEvents(
  records: SbbRecord[],
  index: StationIndex,
  now: Date = new Date(),
): Event[] {
  const out: Event[] = [];
  const seen = new Set<string>();
  const nowMs = now.getTime();
  for (const r of records) {
    const { kind, stations } = parseTitle(r.title);
    if (/resumed|wieder|repris|ripres/i.test(kind)) continue;
    const start = r.startdatetime ? new Date(r.startdatetime).getTime() : nowMs;
    const end = r.enddatetime ? new Date(r.enddatetime).getTime() : undefined;
    if (end !== undefined && end < nowMs - 15 * 60_000) continue; // over
    if (start > nowMs + 24 * 3600_000) continue; // far future
    const points = stations.map((s) => lookup(index, s)).filter((p): p is LonLat => Boolean(p));
    if (points.length === 0) continue;
    const key = `${r.title}|${r.startdatetime ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let severity: 1 | 2 | 3 | 4 | 5 = 2;
    for (const [re, sev] of SEVERITY) {
      if (re.test(kind) || re.test(r.title)) {
        severity = sev;
        break;
      }
    }
    const event: Event = {
      id: `sbb-rti:${r.link?.split("/").pop() ?? key}`,
      kind: severity >= 4 ? "closure" : "disruption",
      severity,
      geometry:
        points.length >= 2
          ? { type: "LineString", coordinates: points }
          : { type: "Point", coordinates: points[0]! },
      startsAt: new Date(start).toISOString(),
      headline: { de: r.title, en: r.title },
      affects: stations,
      source: "sbb-rail-traffic-info",
    };
    if (end !== undefined) event.endsAt = new Date(end).toISOString();
    if (r.description)
      event.description = { de: r.description.slice(0, 400), en: r.description.slice(0, 400) };
    out.push(event);
  }
  return out;
}
