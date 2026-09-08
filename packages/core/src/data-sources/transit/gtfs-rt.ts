/**
 * GTFS-RT TripUpdates (opentransportdata.swiss `/la/gtfs-rt`). Verified 2026-09-08 with a live key:
 * ≈ 8.4 MB protobuf, ≈ 13 500 trip updates, decode ≈ 90 ms; every trip carries startDate,
 * startTime and routeId; stop updates carry absolute epoch `arrival.time` / `departure.time`;
 * scheduleRelationship 0 SCHEDULED, 1 ADDED, 3 CANCELED. Trip ids match GTFS static.
 * Rate limit: design for one fetch per minute.
 */
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

const { transit_realtime: rt } = GtfsRealtimeBindings;

export const GTFS_RT_URL = "https://api.opentransportdata.swiss/la/gtfs-rt";

export interface StopUpdate {
  stopId: string;
  stopSequence?: number;
  /** epoch seconds (absent when the feed only carries a delay) */
  arrival?: number;
  departure?: number;
  /** seconds late (GTFS-RT `delay`); scheduled trips that run on time carry 0 and no time */
  arrivalDelay?: number;
  departureDelay?: number;
  skipped: boolean;
}
export interface TripUpdate {
  tripId: string;
  routeId?: string;
  startDate?: string;
  startTime?: string;
  cancelled: boolean;
  added: boolean;
  stops: StopUpdate[];
}
export interface TripUpdatesFeed {
  timestamp: string;
  updates: Map<string, TripUpdate>;
}

const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && v && "low" in v) {
    const l = v as { low: number; high: number; unsigned?: boolean };
    return l.high * 4294967296 + (l.low >>> 0);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function decodeTripUpdates(bytes: Uint8Array): TripUpdatesFeed {
  const feed = rt.FeedMessage.decode(bytes);
  const ts = toNum(feed.header.timestamp) ?? Math.floor(Date.now() / 1000);
  const updates = new Map<string, TripUpdate>();
  for (const e of feed.entity) {
    const tu = e.tripUpdate;
    if (!tu?.trip?.tripId) continue;
    const rel = tu.trip.scheduleRelationship ?? 0;
    const stops: StopUpdate[] = [];
    for (const s of tu.stopTimeUpdate ?? []) {
      const su: StopUpdate = { stopId: s.stopId ?? "", skipped: s.scheduleRelationship === 1 };
      if (s.stopSequence !== null && s.stopSequence !== undefined) su.stopSequence = s.stopSequence;
      // protobuf int64 defaults decode as Long(0): a zero time means "not set"
      const arr = toNum(s.arrival?.time);
      const dep = toNum(s.departure?.time);
      if (arr) su.arrival = arr;
      if (dep) su.departure = dep;
      if (s.arrival && s.arrival.delay !== null && s.arrival.delay !== undefined)
        su.arrivalDelay = s.arrival.delay;
      if (s.departure && s.departure.delay !== null && s.departure.delay !== undefined)
        su.departureDelay = s.departure.delay;
      stops.push(su);
    }
    const u: TripUpdate = { tripId: tu.trip.tripId, cancelled: rel === 3, added: rel === 1, stops };
    if (tu.trip.routeId) u.routeId = tu.trip.routeId;
    if (tu.trip.startDate) u.startDate = tu.trip.startDate;
    if (tu.trip.startTime) u.startTime = tu.trip.startTime;
    updates.set(u.tripId, u);
  }
  return { timestamp: new Date(ts * 1000).toISOString(), updates };
}

export async function fetchTripUpdates(
  apiKey: string,
  doFetch: typeof fetch = fetch,
): Promise<TripUpdatesFeed> {
  const res = await doFetch(GTFS_RT_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": SWISS_NOW_USER_AGENT,
      Accept: "application/x-protobuf",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`GTFS-RT responded ${res.status}`);
  return decodeTripUpdates(new Uint8Array(await res.arrayBuffer()));
}
