/**
 * adsb.fi community ADS-B feed (readsb JSON; personal, non-commercial use, 1 request/s,
 * attribution required). Verified 2026-09-08: ~150 aircraft within 100 nm of the centre.
 * Blocked by the licence policy in production; local runs may allow it with SWISS_NOW_ALLOW.
 */
import type { Aircraft, AviationState } from "../../state/aviation";
import { computeFreshness } from "../../freshness/index";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const ADSB_FI_RADIUS_NM = 100;
export const adsbFiUrl = (lat = 46.8, lon = 8.2, nm = ADSB_FI_RADIUS_NM) =>
  `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${nm}`;

export interface ReadsbAircraft {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  baro_rate?: number;
  seen_pos?: number;
}
export interface ReadsbJson {
  ac?: ReadsbAircraft[];
  now?: number;
}

const FT = 0.3048;

export function parseAdsb(json: ReadsbJson, now = new Date()): Aircraft[] {
  const base = json.now ? json.now * (json.now < 1e12 ? 1000 : 1) : now.getTime();
  const out: Aircraft[] = [];
  for (const a of json.ac ?? []) {
    if (typeof a.lat !== "number" || typeof a.lon !== "number" || !a.hex) continue;
    if ((a.seen_pos ?? 0) > 60) continue; // stale position
    const ac: Aircraft = {
      icao24: a.hex.toLowerCase(),
      lonLat: [a.lon, a.lat],
      onGround: a.alt_baro === "ground",
      observedAt: new Date(base - (a.seen_pos ?? 0) * 1000).toISOString(),
      positionKind: "reported",
    };
    const callsign = a.flight?.trim();
    if (callsign) ac.callsign = callsign;
    if (a.r) ac.registration = a.r;
    if (a.t) ac.type = a.t;
    if (typeof a.alt_baro === "number") ac.altitudeM = Math.round(a.alt_baro * FT);
    if (typeof a.track === "number") ac.trackDeg = ((a.track % 360) + 360) % 360;
    if (typeof a.gs === "number") ac.groundSpeedKt = a.gs;
    if (typeof a.baro_rate === "number") ac.verticalRateMps = Math.round(a.baro_rate * FT) / 60;
    out.push(ac);
  }
  return out;
}

export function buildAviationState(aircraft: Aircraft[], now = new Date()): AviationState {
  const newest = aircraft.reduce<string | undefined>(
    (b, a) => (!b || a.observedAt > b ? a.observedAt : b),
    undefined,
  );
  return {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    observedAt: newest ?? now.toISOString(),
    freshness: computeFreshness(newest, 10, 5, now),
    sources: ["adsb-fi"],
    aircraft,
    radiusNm: ADSB_FI_RADIUS_NM,
  };
}

export async function fetchAviation(
  fetchFn: typeof fetch = fetch,
  now = new Date(),
): Promise<AviationState> {
  const res = await fetchFn(adsbFiUrl(), {
    headers: { "user-agent": SWISS_NOW_USER_AGENT, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`adsb.fi ${res.status}`);
  return buildAviationState(parseAdsb((await res.json()) as ReadsbJson, now), now);
}
