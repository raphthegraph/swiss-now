import { createHash } from "node:crypto";

/**
 * Pure helpers shared by the build CLI and the runtime (no Node-only imports here).
 */
export const GTFS_PERMALINK =
  "https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020/permalink";

export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 SwissNow/0.0.1";

/** Route types Swiss Now treats as trains for the RAIL layer. */
export const RAIL_ROUTE_TYPES = new Set([
  "2",
  "100",
  "101",
  "102",
  "103",
  "104",
  "105",
  "106",
  "107",
  "108",
  "109",
  "110",
  "111",
  "112",
  "113",
  "114",
  "115",
  "116",
  "117",
  "401",
]);

export function hhmmssToSeconds(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
}

export function patternIdFor(routeId: string, stopIds: string[]): string {
  return createHash("sha1")
    .update(`${routeId}|${stopIds.join(",")}`)
    .digest("hex")
    .slice(0, 12);
}

export function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

/** Local (Europe/Zurich) service dates for today and the next `days` days. */
export function serviceWindow(now: Date, days: number): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const out: string[] = [];
  for (let i = -1; i <= days; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    out.push(fmt.format(d).replaceAll("-", ""));
  }
  return out;
}
