/**
 * Shared primitives of the Swiss Now State.
 *
 * Conventions (see docs/ARCHITECTURE.md §3 and §8):
 * - Coordinates are WGS84 `[lon, lat]` everywhere outside build scripts.
 * - Timestamps are ISO-8601 strings with an explicit offset or `Z`.
 * - Every layer payload carries a `schemaVersion` so web and video can evolve per layer.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

/** ISO-8601 date-time with offset, e.g. `2026-09-07T19:00:00Z`. */
export const ISODateTime = z.iso.datetime({ offset: true });
export type ISODateTime = z.infer<typeof ISODateTime>;

/** `[lon, lat]` in WGS84. Switzerland roughly spans lon 5.9–10.5, lat 45.8–47.9; neighbours allowed. */
export const LonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export type LonLat = z.infer<typeof LonLat>;

/** `[west, south, east, north]` in WGS84. */
export const BBox = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type BBox = z.infer<typeof BBox>;

/** Text in the four national languages plus English. `de` is the only required key. */
export const LocalizedText = z.object({
  de: z.string(),
  fr: z.string().optional(),
  it: z.string().optional(),
  rm: z.string().optional(),
  en: z.string().optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

export const Language = z.enum(["de", "fr", "it", "rm", "en"]);
export type Language = z.infer<typeof Language>;

/** Layer states (one payload each). Topics (`topics/`) select which layers they render. */
export const LayerId = z.enum([
  "weather",
  "hydrology",
  "rail",
  "seismic",
  "traffic",
  "air",
  "energy",
  "events",
  "hazards",
  "aviation",
  "politics",
  "stats",
]);
export type LayerId = z.infer<typeof LayerId>;

/**
 * Freshness is derived from the expected cadence of the underlying source.
 * `live` ≤ 1.5× cadence · `aging` ≤ 3× · `stale` ≤ 12× · `outage` beyond that (or no data).
 */
export const Freshness = z.enum(["live", "aging", "stale", "outage"]);
export type Freshness = z.infer<typeof Freshness>;

/** Two-letter canton codes (ISO 3166-2:CH) plus FL for Liechtenstein where data includes it. */
export const CantonCode = z.enum([
  "AG",
  "AI",
  "AR",
  "BE",
  "BL",
  "BS",
  "FR",
  "GE",
  "GL",
  "GR",
  "JU",
  "LU",
  "NE",
  "NW",
  "OW",
  "SG",
  "SH",
  "SO",
  "SZ",
  "TG",
  "TI",
  "UR",
  "VD",
  "VS",
  "ZG",
  "ZH",
  "FL",
]);
export type CantonCode = z.infer<typeof CantonCode>;

export const Severity = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type Severity = z.infer<typeof Severity>;
