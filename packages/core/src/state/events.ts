/**
 * Events (expansion stage 2): current Swiss news and police communiqués placed on the map. Only
 * the headline, the link and the source are stored (reuse terms of the feeds are unresolved).
 * Places come from our own geocoding with an explicit confidence and method.
 */
import { z } from "zod";
import { CantonCode, ISODateTime, LocalizedText, LonLat } from "./common";
import { LayerBase } from "./layers";
import { SourceId } from "../sources/ids";

export const EventCategory = z.enum([
  "fire",
  "accident",
  "natural-hazard",
  "avalanche",
  "crime",
  "police",
  "news",
]);
export type EventCategory = z.infer<typeof EventCategory>;

export const EventPlace = z.object({
  name: z.string(),
  bfsNumber: z.number().int().optional(),
  cantonCode: CantonCode.optional(),
  lonLat: LonLat,
  /** 0–1; NOW shows ≥ 0.8 only */
  confidence: z.number().min(0).max(1),
  method: z.enum(["register", "gazetteer", "canton-centroid"]),
});
export type EventPlace = z.infer<typeof EventPlace>;

export const NewsEvent = z.object({
  id: z.string().min(1),
  publishedAt: ISODateTime,
  source: SourceId,
  category: EventCategory,
  headline: LocalizedText,
  url: z.url(),
  place: EventPlace.optional(),
});
export type NewsEvent = z.infer<typeof NewsEvent>;

export const EventsState = LayerBase.extend({
  events: z.array(NewsEvent),
  windowHours: z.number().int().positive(),
});
export type EventsState = z.infer<typeof EventsState>;
