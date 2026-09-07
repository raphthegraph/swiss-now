/**
 * Per-layer state contracts. Each is independently fetchable (`/api/state/<layer>`)
 * and independently versioned.
 */
import { z } from "zod";
import { Freshness, ISODateTime, SCHEMA_VERSION } from "./common";
import { Event, Field, Observation, Segment, Station, TripSnapshot } from "./entities";
import { SourceId } from "../sources/ids";

export const LayerBase = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** When Swiss Now produced this payload. */
  updatedAt: ISODateTime,
  /** Newest observation time contained in the payload. */
  observedAt: ISODateTime,
  freshness: Freshness,
  sources: z.array(SourceId).min(1),
});
export type LayerBase = z.infer<typeof LayerBase>;

/** Station id + value pairs for a ranking ("warmest: Magadino 27.1°"). */
export const Extreme = z.object({
  stationId: z.string(),
  value: z.number(),
  observedAt: ISODateTime,
});
export type Extreme = z.infer<typeof Extreme>;

export const WeatherExtremes = z.object({
  warmest: Extreme.optional(),
  coldest: Extreme.optional(),
  wettest1h: Extreme.optional(),
  wettest24h: Extreme.optional(),
  windiestGust: Extreme.optional(),
  deepestSnow: Extreme.optional(),
  sunniest: Extreme.optional(),
});
export type WeatherExtremes = z.infer<typeof WeatherExtremes>;

export const WeatherState = LayerBase.extend({
  stations: z.array(Station),
  observations: z.array(Observation),
  fields: z.array(Field).default([]),
  extremes: WeatherExtremes,
  /** Share of stations reporting precipitation > 0 in the last 10 minutes, 0–1. */
  rainingShare: z.number().min(0).max(1).optional(),
});
export type WeatherState = z.infer<typeof WeatherState>;

export const DangerLevel = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type DangerLevel = z.infer<typeof DangerLevel>;

export const HydrologyState = LayerBase.extend({
  stations: z.array(Station),
  observations: z.array(Observation),
  /** Swiss flood danger level 1–5 per station id (BAFU). */
  dangerLevels: z.record(z.string(), DangerLevel),
  warnings: z.array(Event).default([]),
});
export type HydrologyState = z.infer<typeof HydrologyState>;

export const RailState = LayerBase.extend({
  activeTrips: z.array(TripSnapshot),
  /** Blob URL of the route-path index (`rail/paths/index.json`) built from GTFS + SBB/BAV geometry. */
  pathsUrl: z.url(),
  disruptions: z.array(Event).default([]),
  /** Share of monitored trains within the punctuality threshold, 0–1. */
  onTimeIndex: z.number().min(0).max(1).optional(),
  baselineOnTimeIndex: z.number().min(0).max(1).optional(),
  /** GTFS static build the trips reference, e.g. `gtfs_fp2026_20260905`. */
  gtfsBuild: z.string().optional(),
});
export type RailState = z.infer<typeof RailState>;

export const SeismicState = LayerBase.extend({
  events: z.array(Event),
  /** Window covered by `events`, e.g. 30 days. */
  windowDays: z.number().int().positive(),
});
export type SeismicState = z.infer<typeof SeismicState>;

/** Phase 5. Derived values only — FEDRO forbids raw redistribution. */
export const TrafficState = LayerBase.extend({
  segments: z.array(Segment),
  incidents: z.array(Event),
});
export type TrafficState = z.infer<typeof TrafficState>;

/** Phase 5, city-scale (NABEL has no feed). */
export const AirState = LayerBase.extend({
  stations: z.array(Station),
  observations: z.array(Observation),
  /** Computed Cercl'Air short-term index, 1–6, if available. */
  index: z.number().int().min(1).max(6).optional(),
});
export type AirState = z.infer<typeof AirState>;

/** Phase 5. Hourly at best (ENTSO-E); SFOE daily series feed the story only. */
export const EnergyState = LayerBase.extend({
  loadMW: z.number().optional(),
  generationByTypeMW: z.record(z.string(), z.number()).optional(),
  /** Positive = import into Switzerland, keyed by neighbour ISO code. */
  crossBorderFlowMW: z.partialRecord(z.enum(["AT", "DE", "FR", "IT"]), z.number()).optional(),
});
export type EnergyState = z.infer<typeof EnergyState>;
