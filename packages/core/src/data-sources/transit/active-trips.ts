/**
 * Joins a service-day file with realtime trip updates into TripSnapshots for trips that are
 * running (or about to) at `now`. Positions are NOT computed here — the client and Remotion call
 * `positionAlongTrip()` from @swiss-now/motion per frame. All Swiss trains are `interpolated`.
 */
import type { TripSnapshot, TripStop } from "../../state/entities";
import type { RailDayFile, RailPatternsFile } from "./rail-files";
import type { TripUpdatesFeed } from "./gtfs-rt";

export interface ActiveTripsOptions {
  now: Date;
  /** trips departing within this many seconds are included */
  lookaheadSeconds?: number;
  /** trips arrived within this many seconds are still included (dwell at the terminus) */
  lookbehindSeconds?: number;
  /** stops with an unknown pattern distance get a linear placeholder; paths supply real ones */
  stopDistances?: Map<string, number[]>;
  /** when set, trips whose pattern touches none of these stops are dropped (e.g. wholly abroad) */
  keepIfAnyStop?: Set<string>;
  /** drop stops already passed except the last one, to keep payloads small (default true) */
  trimPassed?: boolean;
}

/** Local midnight (Europe/Zurich) of a YYYYMMDD service day, as epoch ms. GTFS "noon minus 12 h" rule. */
export function serviceDayStart(day: string): number {
  const noon = new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T12:00:00Z`);
  // Zurich offset at that noon (CET or CEST)
  const offsetMin = tzOffsetMinutes(noon, "Europe/Zurich");
  return noon.getTime() - offsetMin * 60_000 - 12 * 3600_000;
}

function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

export function activeTrips(
  day: RailDayFile,
  patterns: RailPatternsFile,
  feed: TripUpdatesFeed | undefined,
  opts: ActiveTripsOptions,
): TripSnapshot[] {
  const { now, lookaheadSeconds = 15 * 60, lookbehindSeconds = 3 * 60, trimPassed = true } = opts;
  const dayStart = serviceDayStart(day.serviceDate);
  const nowSec = (now.getTime() - dayStart) / 1000;
  const out: TripSnapshot[] = [];

  for (const [tripId, patternId, shortName, headsign, times] of day.trips) {
    const pattern = patterns[patternId];
    if (!pattern || times.length < 2) continue;
    if (opts.keepIfAnyStop && !pattern[1].some((id) => opts.keepIfAnyStop!.has(id))) continue;
    const update = feed?.updates.get(tripId);
    const firstDep = times[0]![1];
    const lastArr = times[times.length - 1]![0];
    // realtime may shift the window; use the last known delay for the bounds check
    const delays = perStopDelays(times, pattern[1], update, dayStart);
    const startDelay = delays[0] ?? 0;
    const endDelay = delays[delays.length - 1] ?? 0;
    if (firstDep + startDelay > nowSec + lookaheadSeconds) continue;
    if (lastArr + endDelay < nowSec - lookbehindSeconds) continue;

    const distances = opts.stopDistances?.get(patternId);
    // index of the last stop already departed (effective time); keep it as the interpolation origin
    let from = 0;
    if (trimPassed) {
      for (let i = 0; i < times.length; i++) {
        if (times[i]![1] + (delays[i] ?? 0) <= nowSec) from = i;
        else break;
      }
      // always keep at least two stops so interpolation has a segment (arrived trains dwell at the end)
      from = Math.min(from, times.length - 2);
    }
    const stops: TripStop[] = times.slice(from).map(([arr, dep], j) => {
      const i = j + from;
      return {
        stopId: pattern[1][i] ?? "",
        distanceAlongPath: distances?.[i] ?? i * 1000,
        scheduledArrival: new Date(dayStart + arr * 1000).toISOString(),
        scheduledDeparture: new Date(dayStart + dep * 1000).toISOString(),
        delaySeconds: delays[i] ?? 0,
        skipped: update?.stops.find((s) => s.stopId === pattern[1][i])?.skipped ?? false,
      };
    });
    out.push({
      tripId,
      routeId: pattern[0],
      routeShortName: shortName,
      pathId: patternId,
      positionKind: "interpolated",
      stops,
      headsign,
      cancelled: update?.cancelled ?? false,
      source: "otd-gtfs-rt",
    });
  }
  return out;
}

/**
 * Delay per stop in seconds: realtime absolute times minus schedule where a stop update exists;
 * the last known delay propagates forward (GTFS-RT semantics), zero before the first update.
 */
export function perStopDelays(
  times: RailDayFile["trips"][number][4],
  stopIds: string[],
  update: TripUpdatesFeed["updates"] extends Map<string, infer U> ? U | undefined : never,
  dayStartMs: number,
): number[] {
  const delays = new Array<number>(times.length).fill(0);
  if (!update) return delays;
  const byStop = new Map(update.stops.map((s) => [s.stopId, s] as const));
  let current = 0;
  for (let i = 0; i < times.length; i++) {
    const s = byStop.get(stopIds[i] ?? "");
    if (s) {
      if (s.departure !== undefined)
        current = Math.round(s.departure - (dayStartMs / 1000 + times[i]![1]));
      else if (s.arrival !== undefined)
        current = Math.round(s.arrival - (dayStartMs / 1000 + times[i]![0]));
      else if (s.departureDelay !== undefined) current = s.departureDelay;
      else if (s.arrivalDelay !== undefined) current = s.arrivalDelay;
    }
    delays[i] = current;
  }
  return delays;
}
