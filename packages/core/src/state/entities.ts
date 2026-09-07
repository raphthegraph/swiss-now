/**
 * Normalized entities. Provider schemas never leave `data-sources/<source>/parse.ts`;
 * everything in the app and in Remotion speaks these shapes only.
 */
import { z } from "zod";
import { BBox, CantonCode, ISODateTime, LocalizedText, LonLat, Severity } from "./common";
import { SourceId } from "../sources/ids";

/** Physical quantities Swiss Now understands. Units are fixed per parameter (see `PARAMETER_UNITS`). */
export const Parameter = z.enum([
  // weather
  "airTemperature", // °C
  "dewPoint", // °C
  "relativeHumidity", // %
  "precipitation10min", // mm
  "precipitation1h", // mm
  "precipitation24h", // mm
  "windSpeed", // km/h (10-min mean)
  "windGust", // km/h (1-s peak)
  "windDirection", // ° (from)
  "pressureQFE", // hPa
  "pressureQNH", // hPa
  "globalRadiation", // W/m²
  "sunshineDuration10min", // min
  "snowDepth", // cm
  "newSnow24h", // cm
  "foehnIndex", // 0 | 1 | 2
  // hydrology
  "waterLevel", // m a.s.l.
  "discharge", // m³/s
  "waterTemperature", // °C
  // air quality
  "pm25", // µg/m³
  "pm10", // µg/m³
  "no2", // µg/m³
  "o3", // µg/m³
  // energy
  "load", // MW
  "generation", // MW
  "crossBorderFlow", // MW (positive = import)
]);
export type Parameter = z.infer<typeof Parameter>;

export const PARAMETER_UNITS: Record<Parameter, string> = {
  airTemperature: "°C",
  dewPoint: "°C",
  relativeHumidity: "%",
  precipitation10min: "mm",
  precipitation1h: "mm",
  precipitation24h: "mm",
  windSpeed: "km/h",
  windGust: "km/h",
  windDirection: "°",
  pressureQFE: "hPa",
  pressureQNH: "hPa",
  globalRadiation: "W/m²",
  sunshineDuration10min: "min",
  snowDepth: "cm",
  newSnow24h: "cm",
  foehnIndex: "",
  waterLevel: "m",
  discharge: "m³/s",
  waterTemperature: "°C",
  pm25: "µg/m³",
  pm10: "µg/m³",
  no2: "µg/m³",
  o3: "µg/m³",
  load: "MW",
  generation: "MW",
  crossBorderFlow: "MW",
};

export const StationKind = z.enum(["weather", "hydro-river", "hydro-lake", "snow", "air", "stop"]);
export type StationKind = z.infer<typeof StationKind>;

export const Station = z.object({
  /** Stable id, prefixed by source, e.g. `smn:BER`, `bafu:2019`, `didok:8507000`. */
  id: z.string().min(1),
  name: LocalizedText,
  kind: StationKind,
  lonLat: LonLat,
  elevation: z.number().optional(),
  cantonCode: CantonCode.optional(),
  /** BFS municipality number — the join key to statistics. */
  bfsNumber: z.number().int().positive().optional(),
  /** Water body for hydro stations, e.g. "Aare". */
  waterBody: z.string().optional(),
  source: SourceId,
});
export type Station = z.infer<typeof Station>;

export const ObservationQuality = z.enum(["ok", "suspect", "preliminary"]);

export const Observation = z.object({
  stationId: z.string().min(1),
  parameter: Parameter,
  value: z.number(),
  observedAt: ISODateTime,
  quality: ObservationQuality.optional(),
});
export type Observation = z.infer<typeof Observation>;

/** A gridded raster (radar frame, interpolated temperature) published as an image on Blob. */
export const Field = z.object({
  id: z.string().min(1),
  kind: z.enum(["radar-rain-rate", "radar-rain-1h", "temperature-grid"]),
  bounds: BBox,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  imageUrl: z.url(),
  /** Colour-scale identifier from @swiss-now/motion, so web and video legends match. */
  scaleId: z.string().min(1),
  validAt: ISODateTime,
  source: SourceId,
});
export type Field = z.infer<typeof Field>;

/** A linear feature with a value (congestion index, flow). Geometry lives in a path referenced by id. */
export const Segment = z.object({
  id: z.string().min(1),
  pathId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  value: z.number(),
  unit: z.string(),
  observedAt: ISODateTime,
  source: SourceId,
});
export type Segment = z.infer<typeof Segment>;

export const EventKind = z.enum([
  "incident",
  "roadwork",
  "closure",
  "disruption",
  "earthquake",
  "flood-warning",
  "avalanche",
  "fire-danger",
]);
export type EventKind = z.infer<typeof EventKind>;

/** Minimal GeoJSON geometry (WGS84). */
export const Geometry = z.union([
  z.object({ type: z.literal("Point"), coordinates: LonLat }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(LonLat).min(2) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(LonLat).min(4)) }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(LonLat).min(4))),
  }),
]);
export type Geometry = z.infer<typeof Geometry>;

export const Event = z.object({
  id: z.string().min(1),
  kind: EventKind,
  severity: Severity,
  geometry: Geometry,
  startsAt: ISODateTime,
  endsAt: ISODateTime.optional(),
  headline: LocalizedText,
  description: LocalizedText.optional(),
  /** Referenced entities: station ids, route ids, canton codes. */
  affects: z.array(z.string()).optional(),
  /** Earthquake-specific. */
  magnitude: z.number().optional(),
  depthKm: z.number().optional(),
  /** Whether a human has reviewed the record (SED reviewed catalogue = true). */
  reviewed: z.boolean().optional(),
  source: SourceId,
});
export type Event = z.infer<typeof Event>;

/**
 * A stop on a trip with schedule and realtime information. Positions are NOT stored;
 * they are computed by `positionAlongTrip()` in @swiss-now/motion from these stop times.
 */
export const TripStop = z.object({
  stopId: z.string().min(1),
  /** Distance along the trip's path in metres, from the pattern build step. */
  distanceAlongPath: z.number().nonnegative(),
  scheduledArrival: ISODateTime,
  scheduledDeparture: ISODateTime,
  delaySeconds: z.number().int().default(0),
  skipped: z.boolean().default(false),
});
export type TripStop = z.infer<typeof TripStop>;

/**
 * Snapshot of one active trip. `positionKind` is mandatory and rendered differently:
 * Switzerland publishes no vehicle positions, so all trains are `interpolated`.
 */
export const TripSnapshot = z.object({
  tripId: z.string().min(1),
  routeId: z.string().min(1),
  routeShortName: z.string(),
  /** Id of the precomputed route path (GeoJSON LineString on Blob). */
  pathId: z.string().min(1),
  positionKind: z.enum(["interpolated", "reported"]),
  stops: z.array(TripStop).min(2),
  /** Present only when `positionKind === "reported"`. */
  reportedLonLat: LonLat.optional(),
  headsign: z.string().optional(),
  agency: z.string().optional(),
  cancelled: z.boolean().default(false),
  source: SourceId,
});
export type TripSnapshot = z.infer<typeof TripSnapshot>;
