/**
 * Zürich UGZ hourly air quality (CC0, verified 2026-09-08): one yearly CSV appended hourly, 30 min
 * after the hour. We read only its tail with an HTTP Range request (the file is ~13 MB).
 * Columns: Datum (fixed +0100), Standort, Parameter, Intervall, Einheit, Wert, Status.
 */
import { parse } from "csv-parse/sync";
import type { Observation, Parameter, Station } from "../../state/entities";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const UGZ_CSV_URL = (year: number) =>
  `https://data.stadt-zuerich.ch/dataset/ugz_luftschadstoffmessung_stundenwerte/download/ugz_ogd_air_h1_${year}.csv`;
/** bytes to read from the end: a few hours of all stations and parameters */
export const UGZ_TAIL_BYTES = 200_000;

/** Site coordinates (the CSV has none); from the UGZ site list. */
export const UGZ_SITES: Record<
  string,
  { name: string; lonLat: [number, number]; elevation: number }
> = {
  Zch_Stampfenbachstrasse: {
    name: "Zürich Stampfenbachstrasse",
    lonLat: [8.5398, 47.3868],
    elevation: 445,
  },
  Zch_Schimmelstrasse: { name: "Zürich Schimmelstrasse", lonLat: [8.5235, 47.371], elevation: 413 },
  Zch_Rosengartenstrasse: {
    name: "Zürich Rosengartenstrasse",
    lonLat: [8.5261, 47.3952],
    elevation: 433,
  },
  Zch_Rosengartenbrücke: {
    name: "Zürich Rosengartenbrücke",
    lonLat: [8.5253, 47.3943],
    elevation: 424,
  },
  Zch_Heubeeribüel: { name: "Zürich Heubeeribüel", lonLat: [8.5659, 47.3815], elevation: 610 },
};

const PARAM: Record<string, Parameter> = { NO2: "no2", O3: "o3", PM10: "pm10", "PM2.5": "pm25" };

export const ugzStationId = (site: string) => `ugz:${site}`;

/** `2026-09-08T14:00+0100` → ISO instant (the file uses a fixed +01:00 offset all year). */
export function ugzTime(s: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})([+-]\d{2})(\d{2})$/.exec(s.trim());
  return m ? new Date(`${m[1]}:00${m[2]}:${m[3]}`).toISOString() : new Date(s).toISOString();
}

/** Parses a byte tail (the first partial line is dropped) into the latest observation per site and parameter. */
export function parseUgzTail(tail: string): { stations: Station[]; observations: Observation[] } {
  const body = tail.slice(tail.indexOf("\n") + 1);
  const rows = parse(body, {
    columns: ["Datum", "Standort", "Parameter", "Intervall", "Einheit", "Wert", "Status"],
    relax_column_count: true,
    skip_empty_lines: true,
    relax_quotes: true,
  }) as Record<string, string>[];
  const latest = new Map<string, Observation>();
  for (const r of rows) {
    const param = PARAM[r["Parameter"] ?? ""];
    const site = r["Standort"] ?? "";
    const value = Number(r["Wert"]);
    if (!param || !UGZ_SITES[site] || !Number.isFinite(value) || !r["Datum"]) continue;
    let at: string;
    try {
      at = ugzTime(r["Datum"]);
    } catch {
      continue;
    }
    const key = `${site}|${param}`;
    const prev = latest.get(key);
    if (!prev || prev.observedAt < at)
      latest.set(key, {
        stationId: ugzStationId(site),
        parameter: param,
        value,
        observedAt: at,
        quality: r["Status"] === "provisorisch" ? "preliminary" : "ok",
      });
  }
  const used = new Set([...latest.values()].map((o) => o.stationId));
  const stations: Station[] = Object.entries(UGZ_SITES)
    .filter(([site]) => used.has(ugzStationId(site)))
    .map(([site, s]) => ({
      id: ugzStationId(site),
      name: { de: s.name, en: s.name },
      kind: "air",
      tier: "reference",
      lonLat: s.lonLat,
      elevation: s.elevation,
      cantonCode: "ZH",
      source: "ugz-air",
    }));
  return { stations, observations: [...latest.values()] };
}

export async function fetchUgzTail(
  fetchFn: typeof fetch = fetch,
  now = new Date(),
): Promise<string> {
  const res = await fetchFn(UGZ_CSV_URL(now.getUTCFullYear()), {
    headers: { range: `bytes=-${UGZ_TAIL_BYTES}`, "user-agent": SWISS_NOW_USER_AGENT },
  });
  if (!res.ok) throw new Error(`ugz ${res.status}`);
  const text = await res.text();
  // if the server ignored the range we still only need the tail
  return text.length > UGZ_TAIL_BYTES * 2 ? text.slice(-UGZ_TAIL_BYTES) : text;
}
