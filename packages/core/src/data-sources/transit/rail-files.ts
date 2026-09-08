/**
 * Compact output files for the RAIL layer (written by the build CLI, read by the web handler).
 * Everything is plain JSON so it can live on Vercel Blob or in `public/` unchanged.
 */
import type { GtfsBuild, StopTimePair } from "./gtfs-static";

export interface RailMeta {
  schemaVersion: 1;
  feedVersion: string;
  feedStart: string;
  feedEnd: string;
  builtAt: string;
  days: string[];
  counts: { routes: number; stops: number; patterns: number; trips: number };
}
/** stop id → [lon, lat, name, didok?] */
export type RailStopsFile = Record<string, [number, number, string, string?]>;
/** route id → [shortName, type, agencyId] */
export type RailRoutesFile = Record<string, [string, string, string]>;
/** pattern id → [routeId, stopIds[]] */
export type RailPatternsFile = Record<string, [string, string[]]>;
/** one service day: [tripId, patternId, shortName, headsign, times[]] */
export type RailDayTrip = [string, string, string, string, StopTimePair[]];
export interface RailDayFile {
  schemaVersion: 1;
  serviceDate: string;
  feedVersion: string;
  trips: RailDayTrip[];
}

export function toStopsFile(b: GtfsBuild): RailStopsFile {
  const out: RailStopsFile = {};
  for (const s of b.stops.values())
    out[s.id] = s.didok
      ? [s.lonLat[0], s.lonLat[1], s.name, s.didok]
      : [s.lonLat[0], s.lonLat[1], s.name];
  return out;
}
export function toRoutesFile(b: GtfsBuild): RailRoutesFile {
  const out: RailRoutesFile = {};
  for (const r of b.routes.values()) out[r.routeId] = [r.shortName, r.type, r.agencyId];
  return out;
}
export function toPatternsFile(b: GtfsBuild): RailPatternsFile {
  const out: RailPatternsFile = {};
  for (const p of b.patterns.values()) out[p.id] = [p.routeId, p.stopIds];
  return out;
}
export function toDayFile(b: GtfsBuild, day: string, builtAt: string): RailDayFile {
  const trips: RailDayTrip[] = [];
  for (const t of b.trips.values()) {
    if (!b.serviceDays.get(t.serviceId)?.has(day)) continue;
    trips.push([t.tripId, t.patternId, t.shortName, t.headsign, t.times]);
  }
  trips.sort((a, c) => (a[4][0]![1] ?? 0) - (c[4][0]![1] ?? 0));
  void builtAt;
  return { schemaVersion: 1, serviceDate: day, feedVersion: b.feedVersion, trips };
}
