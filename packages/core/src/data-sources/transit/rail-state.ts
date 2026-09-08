import type { RailState } from "../../state/layers";
import type { TripSnapshot } from "../../state/entities";
import { SCHEMA_VERSION } from "../../state/common";
import { computeFreshness } from "../../freshness/index";
import { activeTrips } from "./active-trips";
import type { TripUpdatesFeed } from "./gtfs-rt";
import type { RailDayFile, RailPatternsFile, RailRoutesFile } from "./rail-files";

export interface RailDistancesFile {
  [patternId: string]: { path?: string; d: number[]; straight: number; length: number };
}

export interface RailStateInputs {
  day: RailDayFile;
  patterns: RailPatternsFile;
  routes?: RailRoutesFile | undefined;
  distances?: RailDistancesFile | undefined;
  feed?: TripUpdatesFeed | undefined;
  /** public base URL of the path files, e.g. `/rail/paths` */
  pathsUrl: string;
  gtfsBuild: string;
  now?: Date;
  /** stop ids inside Switzerland; trips touching none of them are dropped */
  stopsInSwitzerland?: Set<string> | undefined;
}

/** Punctuality threshold used for the on-time index (Swiss convention: < 3 minutes). */
export const ON_TIME_THRESHOLD_SECONDS = 180;

/** Delay of a trip "now": the delay at the last stop already passed (or the next one before departure). */
export function currentDelay(trip: TripSnapshot, nowMs: number): number {
  let delay = trip.stops[0]?.delaySeconds ?? 0;
  for (const s of trip.stops) {
    if (new Date(s.scheduledDeparture).getTime() + s.delaySeconds * 1000 <= nowMs)
      delay = s.delaySeconds;
    else break;
  }
  return delay;
}

export function buildRailState(inputs: RailStateInputs): RailState {
  const now = inputs.now ?? new Date();
  const stopDistances = new Map<string, number[]>();
  const pathIds = new Map<string, string>();
  if (inputs.distances)
    for (const [pid, v] of Object.entries(inputs.distances)) {
      stopDistances.set(pid, v.d);
      if (v.path) pathIds.set(pid, v.path);
    }

  const tripOpts: Parameters<typeof activeTrips>[3] = { now, stopDistances };
  if (inputs.stopsInSwitzerland) tripOpts.keepIfAnyStop = inputs.stopsInSwitzerland;
  const trips = activeTrips(inputs.day, inputs.patterns, inputs.feed, tripOpts);
  for (const t of trips) {
    const shared = pathIds.get(t.pathId);
    if (shared) t.pathId = shared;
  }
  // display the line name (IC 1, S10) from routes; the day file carries the train number
  if (inputs.routes) {
    for (const t of trips) {
      const r = inputs.routes[t.routeId];
      if (r && r[0]) {
        t.trainNumber = t.routeShortName;
        t.routeShortName = r[0];
      }
    }
  }
  const running = trips.filter((t) => !t.cancelled);
  const nowMs = now.getTime();
  let onTime = 0;
  for (const t of running) if (currentDelay(t, nowMs) < ON_TIME_THRESHOLD_SECONDS) onTime++;

  const observedAt = inputs.feed?.timestamp ?? now.toISOString();
  const freshness = inputs.feed ? computeFreshness(observedAt, 60, 30, now) : "stale";

  const state: RailState = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    observedAt,
    freshness,
    sources: inputs.feed ? ["otd-gtfs-rt", "otd-gtfs-static"] : ["otd-gtfs-static"],
    activeTrips: trips,
    pathsUrl: inputs.pathsUrl,
    disruptions: [],
    gtfsBuild: inputs.gtfsBuild,
  };
  if (running.length > 0) state.onTimeIndex = onTime / running.length;
  return state;
}
