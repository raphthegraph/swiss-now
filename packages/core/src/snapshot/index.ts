/**
 * Composite snapshots power the timeline (NOW ← 1h ← 3h ← 6h ← 12h ← TODAY) and the story builder.
 * One snapshot every 10 minutes ≈ 250 KB JSON; kept 48 h at full resolution (docs/ARCHITECTURE.md §2).
 * On Vercel Hobby there is no cron: snapshots are written opportunistically while someone is
 * watching (and by a GitHub Actions ping once deployed), so gaps are honest, not hidden.
 */
import { z } from "zod";
import { ISODateTime, SCHEMA_VERSION } from "../state/common";
import { Event } from "../state/entities";
import { HydrologyState, SeismicState, WeatherState } from "../state/layers";
import type { RailState } from "../state/layers";

export const SNAPSHOT_INTERVAL_SECONDS = 600;

/** Rail is summarised: a snapshot never carries the ≈ 1 000 active trips. */
export const RailSummary = z.object({
  observedAt: ISODateTime,
  freshness: z.enum(["live", "aging", "stale", "outage"]),
  running: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  onTimeIndex: z.number().min(0).max(1).optional(),
  /** up to five most delayed trains at snapshot time */
  worst: z.array(
    z.object({
      line: z.string(),
      trainNumber: z.string().optional(),
      headsign: z.string().optional(),
      delaySeconds: z.number().int(),
    }),
  ),
  disruptions: z.array(Event),
});
export type RailSummary = z.infer<typeof RailSummary>;

export const Snapshot = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** snapshot time, rounded down to the 10-minute slot (UTC) */
  at: ISODateTime,
  generatedAt: ISODateTime,
  weather: WeatherState.optional(),
  hydrology: HydrologyState.optional(),
  rail: RailSummary.optional(),
  seismic: SeismicState.optional(),
});
export type Snapshot = z.infer<typeof Snapshot>;

export interface SnapshotMeta {
  at: string;
  url: string;
  bytes?: number;
}

/** Floors a time to the 10-minute slot; snapshot ids are `YYYYMMDDTHHMM` in UTC. */
export function snapshotSlot(date: Date, intervalSeconds = SNAPSHOT_INTERVAL_SECONDS): Date {
  const ms = intervalSeconds * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}
export function snapshotId(at: Date): string {
  return at.toISOString().slice(0, 16).replace(/[-:]/g, "");
}
export function parseSnapshotId(id: string): Date | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})$/.exec(id);
  if (!m) return undefined;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])),
  );
}

export function summarizeRail(
  rail: RailState,
  now: Date,
  currentDelay: (t: RailState["activeTrips"][number], nowMs: number) => number,
): RailSummary {
  const running = rail.activeTrips.filter((t) => !t.cancelled);
  const nowMs = now.getTime();
  const worst = running
    .map((t) => ({ t, d: currentDelay(t, nowMs) }))
    .filter((x) => x.d >= 180)
    .sort((a, b) => b.d - a.d)
    .slice(0, 5)
    .map(({ t, d }) => {
      const w: RailSummary["worst"][number] = { line: t.routeShortName, delaySeconds: d };
      if (t.trainNumber) w.trainNumber = t.trainNumber;
      if (t.headsign) w.headsign = t.headsign;
      return w;
    });
  const summary: RailSummary = {
    observedAt: rail.observedAt,
    freshness: rail.freshness,
    running: running.length,
    cancelled: rail.activeTrips.length - running.length,
    worst,
    disruptions: rail.disruptions,
  };
  if (rail.onTimeIndex !== undefined) summary.onTimeIndex = rail.onTimeIndex;
  return summary;
}

export interface BuildSnapshotInputs {
  now: Date;
  weather?: WeatherState | undefined;
  hydrology?: HydrologyState | undefined;
  rail?: RailSummary | undefined;
  seismic?: SeismicState | undefined;
}

/** Assembles a snapshot; the weather keeps only its newest radar frame to stay small. */
export function buildSnapshot(i: BuildSnapshotInputs): Snapshot {
  const at = snapshotSlot(i.now);
  const snap: Snapshot = {
    schemaVersion: SCHEMA_VERSION,
    at: at.toISOString(),
    generatedAt: i.now.toISOString(),
  };
  if (i.weather) {
    const latest = i.weather.fields.find((f) => f.kind === "radar-rain-rate");
    snap.weather = { ...i.weather, fields: latest ? [latest] : [] };
  }
  if (i.hydrology) snap.hydrology = i.hydrology;
  if (i.rail) snap.rail = i.rail;
  if (i.seismic) snap.seismic = { ...i.seismic, events: i.seismic.events.slice(0, 50) };
  return snap;
}
