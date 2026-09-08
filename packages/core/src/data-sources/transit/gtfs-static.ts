/**
 * GTFS static (opentransportdata.swiss, FP2026). Verified 2026-09-08: zip ≈ 248 MB with
 * stop_times.txt ≈ 3.07 GB uncompressed and 2.17 M trips, so everything streams. Trip ids match
 * the GTFS-RT feed (e.g. `.ojp-91-71B.1.TA.102.j26`); stop ids are SLOIDs (`ch:1:sloid:…`) or
 * DiDok numbers, and stops.txt carries a `didok` column for joining the realtime feed.
 * Extended route types: 100–117 rail (101 high speed, 102 long distance, 103 inter-regional,
 * 105 sleeper, 106 regional, 107 tourist, 109 suburban, 116 rack, 117 additional), 401 metro.
 */
import { createHash } from "node:crypto";
import { parse } from "csv-parse";
import StreamZip from "node-stream-zip";

import { RAIL_ROUTE_TYPES, hhmmssToSeconds, patternIdFor, serviceWindow } from "./gtfs-static-lite";
export {
  GTFS_PERMALINK,
  BROWSER_UA,
  RAIL_ROUTE_TYPES,
  hhmmssToSeconds,
  patternIdFor,
  serviceWindow,
  yyyymmdd,
} from "./gtfs-static-lite";

export interface RailRoute {
  routeId: string;
  shortName: string;
  longName: string;
  type: string;
  agencyId: string;
}

export interface RailStop {
  id: string;
  name: string;
  lonLat: [number, number];
  didok?: string;
  parent?: string;
}

export interface RailPattern {
  id: string;
  routeId: string;
  stopIds: string[];
}

export type StopTimePair = [number, number];

export interface RailTrip {
  tripId: string;
  patternId: string;
  serviceId: string;
  headsign: string;
  shortName: string;
  times: StopTimePair[];
}

export interface GtfsBuild {
  feedVersion: string;
  feedStart: string;
  feedEnd: string;
  routes: Map<string, RailRoute>;
  stops: Map<string, RailStop>;
  patterns: Map<string, RailPattern>;
  trips: Map<string, RailTrip>;
  /** service id → set of YYYYMMDD dates on which it runs (within the requested window) */
  serviceDays: Map<string, Set<string>>;
}

type Row = Record<string, string>;

async function streamCsv(
  zip: StreamZip.StreamZipAsync,
  entry: string,
  onRow: (row: Row) => void,
  log?: (n: number) => void,
): Promise<number> {
  const stream = await zip.stream(entry);
  const parser = stream.pipe(
    parse({ columns: true, bom: true, relax_quotes: true, skip_empty_lines: true }),
  );
  let n = 0;
  for await (const row of parser as AsyncIterable<Row>) {
    onRow(row);
    n++;
    if (log && n % 2_000_000 === 0) log(n);
  }
  return n;
}

export interface BuildOptions {
  zipPath: string;
  now?: Date;
  /** days ahead to resolve service calendars for (default 7) */
  days?: number;
  log?: (msg: string) => void;
}

/** Streams the archive once per file and returns the rail subset in memory (≈ a few hundred MB). */
export async function buildRailFromGtfs(opts: BuildOptions): Promise<GtfsBuild> {
  const log = opts.log ?? (() => {});
  const zip = new StreamZip.async({ file: opts.zipPath });
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

  // feed_info
  let feedVersion = "";
  let feedStart = "";
  let feedEnd = "";
  await streamCsv(zip, "feed_info.txt", (r) => {
    feedVersion = r["feed_version"] ?? "";
    feedStart = r["feed_start_date"] ?? "";
    feedEnd = r["feed_end_date"] ?? "";
  });

  // routes → rail only
  const routes = new Map<string, RailRoute>();
  await streamCsv(zip, "routes.txt", (r) => {
    if (!RAIL_ROUTE_TYPES.has(r["route_type"] ?? "")) return;
    routes.set(r["route_id"]!, {
      routeId: r["route_id"]!,
      shortName: r["route_short_name"] ?? "",
      longName: r["route_long_name"] ?? "",
      type: r["route_type"]!,
      agencyId: r["agency_id"] ?? "",
    });
  });
  log(`routes: ${routes.size} rail routes (${elapsed()})`);

  // trips → rail only
  const tripMeta = new Map<
    string,
    { routeId: string; serviceId: string; headsign: string; shortName: string }
  >();
  const nTrips = await streamCsv(zip, "trips.txt", (r) => {
    if (!routes.has(r["route_id"]!)) return;
    tripMeta.set(r["trip_id"]!, {
      routeId: r["route_id"]!,
      serviceId: r["service_id"]!,
      headsign: r["trip_headsign"] ?? "",
      shortName: r["trip_short_name"] ?? "",
    });
  });
  log(`trips: ${tripMeta.size} rail of ${nTrips} (${elapsed()})`);

  // service days within the window (calendar + calendar_dates), only for services in use
  const window = new Set(serviceWindow(opts.now ?? new Date(), opts.days ?? 7));
  const usedServices = new Set([...tripMeta.values()].map((t) => t.serviceId));
  const serviceDays = new Map<string, Set<string>>();
  const weekdayKeys = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  await streamCsv(zip, "calendar.txt", (r) => {
    const sid = r["service_id"]!;
    if (!usedServices.has(sid)) return;
    const start = r["start_date"] ?? "00000000";
    const end = r["end_date"] ?? "99999999";
    for (const day of window) {
      if (day < start || day > end) continue;
      const d = new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T12:00:00Z`);
      if (r[weekdayKeys[d.getUTCDay()] ?? "sunday"] === "1") {
        if (!serviceDays.has(sid)) serviceDays.set(sid, new Set());
        serviceDays.get(sid)!.add(day);
      }
    }
  });
  await streamCsv(
    zip,
    "calendar_dates.txt",
    (r) => {
      const sid = r["service_id"]!;
      const day = r["date"]!;
      if (!usedServices.has(sid) || !window.has(day)) return;
      if (!serviceDays.has(sid)) serviceDays.set(sid, new Set());
      if (r["exception_type"] === "1") serviceDays.get(sid)!.add(day);
      else serviceDays.get(sid)!.delete(day);
    },
    (n) => log(`calendar_dates: ${n} rows (${elapsed()})`),
  );
  log(
    `services with days in window: ${[...serviceDays.values()].filter((s) => s.size).length} (${elapsed()})`,
  );

  // stop_times → per trip stop sequence + times (3 GB stream; keep only rail trips)
  const seqs = new Map<string, { stopIds: string[]; times: StopTimePair[]; seq: number[] }>();
  await streamCsv(
    zip,
    "stop_times.txt",
    (r) => {
      const tripId = r["trip_id"]!;
      if (!tripMeta.has(tripId)) return;
      let s = seqs.get(tripId);
      if (!s) {
        s = { stopIds: [], times: [], seq: [] };
        seqs.set(tripId, s);
      }
      s.stopIds.push(r["stop_id"]!);
      s.times.push([
        hhmmssToSeconds(r["arrival_time"] ?? r["departure_time"]!),
        hhmmssToSeconds(r["departure_time"] ?? r["arrival_time"]!),
      ]);
      s.seq.push(Number(r["stop_sequence"]));
    },
    (n) => log(`stop_times: ${n} rows (${elapsed()})`),
  );
  log(`stop_times: ${seqs.size} trips with stops (${elapsed()})`);

  // patterns + trips
  const patterns = new Map<string, RailPattern>();
  const trips = new Map<string, RailTrip>();
  const usedStops = new Set<string>();
  for (const [tripId, s] of seqs) {
    const meta = tripMeta.get(tripId)!;
    // stop_times are not guaranteed ordered; sort by stop_sequence
    const order = s.seq
      .map((v, i) => [v, i] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, i]) => i);
    const stopIds = order.map((i) => s.stopIds[i]!);
    const times = order.map((i) => s.times[i]!);
    if (stopIds.length < 2) continue;
    const pid = patternIdFor(meta.routeId, stopIds);
    if (!patterns.has(pid)) patterns.set(pid, { id: pid, routeId: meta.routeId, stopIds });
    for (const id of stopIds) usedStops.add(id);
    trips.set(tripId, {
      tripId,
      patternId: pid,
      serviceId: meta.serviceId,
      headsign: meta.headsign,
      shortName: meta.shortName,
      times,
    });
  }
  seqs.clear();
  log(
    `patterns: ${patterns.size}, trips: ${trips.size}, stops used: ${usedStops.size} (${elapsed()})`,
  );

  // stops (only those used; include parents for names)
  const stops = new Map<string, RailStop>();
  await streamCsv(zip, "stops.txt", (r) => {
    const id = r["stop_id"]!;
    if (!usedStops.has(id)) return;
    const lon = Number(r["stop_lon"]);
    const lat = Number(r["stop_lat"]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const stop: RailStop = {
      id,
      name: r["stop_name"] ?? id,
      lonLat: [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6],
    };
    if (r["didok"]) stop.didok = r["didok"];
    if (r["parent_station"]) stop.parent = r["parent_station"];
    stops.set(id, stop);
  });
  log(`stops: ${stops.size} (${elapsed()})`);

  await zip.close();
  return { feedVersion, feedStart, feedEnd, routes, stops, patterns, trips, serviceDays };
}
