/**
 * Swiss Seismological Service (SED / ETH Zurich) FDSN event service. Verified 2026-09-08:
 * `https://eida.ethz.ch/fdsnws/event/1/query`, formats text/csv/QuakeML (no JSON), no key, CORS.
 * The catalogue is manually reviewed (origins appear hours after an event); a 30-day bbox query
 * returns ≈ 180 events, most below magnitude 2, plus quarry blasts and landslides which we drop.
 * Licence: the SED disclaimer allows private, scientific and non-commercial use; attribution
 * "Source: Swiss Seismological Service (SED) at ETH Zurich". Commercial reuse needs clearance.
 */
import type { Event } from "../../state/entities";
import type { SeismicState } from "../../state/layers";
import { SCHEMA_VERSION } from "../../state/common";
import { computeFreshness } from "../../freshness/index";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const FDSN_EVENT_URL = "https://eida.ethz.ch/fdsnws/event/1/query";
/** Switzerland plus a margin so felt quakes just across the border still show. */
export const SEISMIC_BBOX = { minLat: 45.5, maxLat: 48.2, minLon: 5.5, maxLon: 11 } as const;
export const SEISMIC_WINDOW_DAYS = 30;

export interface FdsnEvent {
  id: string;
  time: string;
  lat: number;
  lon: number;
  depthKm: number;
  magnitude: number;
  magType: string;
  place: string;
  type: string;
}

/** Parses the pipe-delimited FDSN `format=text` response. */
export function parseFdsnText(text: string): FdsnEvent[] {
  const out: FdsnEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const c = line.split("|");
    if (c.length < 14) continue;
    const lat = Number(c[2]);
    const lon = Number(c[3]);
    const mag = Number(c[10]);
    const time = c[1] ?? "";
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mag) || !time) continue;
    out.push({
      id: (c[0] ?? "").split("/").pop() ?? c[0]!,
      time: time.endsWith("Z") ? time : `${time}Z`,
      lat,
      lon,
      depthKm: Number(c[4]) || 0,
      magnitude: mag,
      magType: c[9] ?? "",
      place: (c[12] ?? "").trim(),
      type: (c[13] ?? "").trim(),
    });
  }
  return out;
}

export function fdsnUrl(now: Date, days = SEISMIC_WINDOW_DAYS): string {
  const start = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 19);
  const p = new URLSearchParams({
    format: "text",
    starttime: start,
    minlatitude: String(SEISMIC_BBOX.minLat),
    maxlatitude: String(SEISMIC_BBOX.maxLat),
    minlongitude: String(SEISMIC_BBOX.minLon),
    maxlongitude: String(SEISMIC_BBOX.maxLon),
    orderby: "time",
  });
  return `${FDSN_EVENT_URL}?${p.toString()}`;
}

export async function fetchFdsnEvents(
  doFetch: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<FdsnEvent[]> {
  const res = await doFetch(fdsnUrl(now), {
    headers: { "User-Agent": SWISS_NOW_USER_AGENT, Accept: "text/plain" },
  });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`SED FDSN responded ${res.status}`);
  return parseFdsnText(await res.text());
}

/** Severity 1–5 from magnitude: < 2 → 1, 2–3 → 2, 3–4 → 3, 4–5 → 4, ≥ 5 → 5. */
export function magnitudeSeverity(m: number): 1 | 2 | 3 | 4 | 5 {
  if (m >= 5) return 5;
  if (m >= 4) return 4;
  if (m >= 3) return 3;
  if (m >= 2) return 2;
  return 1;
}

export function fdsnToEvents(events: FdsnEvent[]): Event[] {
  return events
    .filter((e) => e.type === "earthquake")
    .map((e) => {
      const m = Math.round(e.magnitude * 10) / 10;
      const headline = `M${m.toFixed(1)} earthquake near ${e.place}`;
      const ev: Event = {
        id: `sed:${e.id}`,
        kind: "earthquake",
        severity: magnitudeSeverity(m),
        geometry: {
          type: "Point",
          coordinates: [Math.round(e.lon * 1e4) / 1e4, Math.round(e.lat * 1e4) / 1e4],
        },
        startsAt: new Date(e.time).toISOString(),
        headline: { de: `Erdbeben M${m.toFixed(1)} bei ${e.place}`, en: headline },
        magnitude: m,
        depthKm: Math.round(e.depthKm * 10) / 10,
        reviewed: true,
        source: "sed-fdsn",
      };
      return ev;
    })
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
}

export function buildSeismicState(fdsn: FdsnEvent[], now: Date = new Date()): SeismicState {
  const events = fdsnToEvents(fdsn);
  const observedAt = events[0]?.startsAt;
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    // the catalogue "observation" is the query moment: reviewed events land hours later by design
    observedAt: now.toISOString(),
    freshness: computeFreshness(now, 120, 0, now),
    sources: ["sed-fdsn"],
    events,
    windowDays: SEISMIC_WINDOW_DAYS,
    ...(observedAt ? { latestEventAt: observedAt } : {}),
  } as SeismicState;
}

export async function loadSeismicState(
  doFetch: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<SeismicState> {
  return buildSeismicState(await fetchFdsnEvents(doFetch, now), now);
}
