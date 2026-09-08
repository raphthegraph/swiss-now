/**
 * The story spec is the one deliberate coupling between the web "Today" mode and the
 * Remotion compositions: same narrative, different renderers.
 */
import { z } from "zod";
import { ISODateTime, LayerId, LocalizedText, LonLat } from "./common";

export const CameraSpec = z.object({
  center: LonLat,
  zoom: z.number().min(0).max(22),
  bearing: z.number().default(0),
  pitch: z.number().min(0).max(60).default(0),
});
export type CameraSpec = z.infer<typeof CameraSpec>;

export const ChapterType = z.enum([
  "weather-summary",
  "extremes",
  "rainfall",
  "rail",
  "river",
  "quake",
  "snow",
  "energy",
  "stat",
  // expansion (docs/IA.md)
  "events",
  "hazard",
  "air",
  "vote",
]);
export type ChapterType = z.infer<typeof ChapterType>;

/**
 * A geographic marker a chapter renderer draws over the map (the video projects them through its
 * map plate; the web can use them for highlights). Coordinates travel with the story so a renderer
 * needs no state lookups.
 */
export const StoryMarkerKind = z.enum([
  "temperature",
  "rain",
  "gust",
  "snow",
  "river",
  "quake",
  "disruption",
  "place",
]);
export type StoryMarkerKind = z.infer<typeof StoryMarkerKind>;

export const StoryMarker = z.object({
  id: z.string().min(1),
  kind: StoryMarkerKind,
  lonLat: LonLat,
  /** Display name (already localized by the builder). */
  label: z.string().optional(),
  value: z.number().optional(),
  unit: z.string().optional(),
  /** Emphasised markers get a label and a larger mark. */
  emphasis: z.boolean().default(false),
});
export type StoryMarker = z.infer<typeof StoryMarker>;

export const Chapter = z.object({
  id: z.string().min(1),
  type: ChapterType,
  layer: LayerId,
  headline: LocalizedText,
  body: LocalizedText.optional(),
  /** Entity references the renderer should highlight (station ids, event ids, canton codes). */
  highlights: z.array(z.string()).default([]),
  /** Chapter-specific payload (KPI list, event, field frames), validated by the chapter renderer. */
  data: z.unknown(),
  /** Markers to draw over the map for this chapter. */
  markers: z.array(StoryMarker).default([]),
  camera: CameraSpec,
  /** Suggested duration in seconds; the video derives `durationInFrames` from it. */
  durationHint: z.number().positive(),
  /** Ranking score used to order and cut chapters. */
  score: z.number(),
});
export type Chapter = z.infer<typeof Chapter>;

export const StorySpec = z.object({
  schemaVersion: z.literal(1),
  /** Local date in Switzerland, `YYYY-MM-DD`. */
  date: z.iso.date(),
  generatedAt: ISODateTime,
  title: LocalizedText,
  chapters: z.array(Chapter).min(1),
  /** Attribution lines for the end card. */
  credits: z.array(z.string()),
});
export type StorySpec = z.infer<typeof StorySpec>;
