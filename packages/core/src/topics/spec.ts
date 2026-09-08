/**
 * The information architecture: topics (what) are independent of modes (how). A topic is one
 * subject with its sources, cadence and geography; a mode is one way of looking at it
 * (docs/IA.md). The web rail and mode switcher, the story builder and the video all read this.
 */
import { z } from "zod";
import type { LocalizedText, LayerId } from "../state/common";
import type { SourceId } from "../sources/ids";

export const TopicId = z.enum([
  "now",
  // LIVE — seconds to hours, points and rasters
  "weather",
  "water",
  "air",
  "hazards",
  "events",
  // SYSTEMS — networks and flows
  "rail",
  "energy",
  "aviation",
  // SWITZERLAND — months to years, municipality and canton polygons
  "politics",
  "population",
  "housing",
  "economy",
  "tourism",
  "trade",
]);
export type TopicId = z.infer<typeof TopicId>;

export const TopicGroup = z.enum(["now", "live", "systems", "switzerland"]);
export type TopicGroup = z.infer<typeof TopicGroup>;

export const Mode = z.enum(["map", "charts", "timeline", "compare"]);
export type Mode = z.infer<typeof Mode>;

export const GeoLevel = z.enum([
  "point",
  "raster",
  "network",
  "municipality",
  "canton",
  "country",
  "world",
]);
export type GeoLevel = z.infer<typeof GeoLevel>;

/** How a topic contributes to the NOW composite. */
export type NowPresence =
  /** always present in quiet form (e.g. energy border arrows) */
  | "always"
  /** only when something notable is happening (danger ≥ 2, delays, M ≥ 2, confident events) */
  | "notable"
  /** only on a federal vote Sunday */
  | "vote-sunday";

export interface TopicSpec {
  id: TopicId;
  group: TopicGroup;
  label: LocalizedText;
  /** Key into `@swiss-now/motion` `layerAccent` (validated by the motion tests). */
  accent: string;
  /** Layer states this topic renders from. */
  layerIds: LayerId[];
  /** Sources the topic depends on; the policy gate decides whether the topic is available. */
  sources: SourceId[];
  cadenceSeconds: number;
  geoLevel: GeoLevel;
  /** Modes this topic supports; others render dimmed. `map` is always first. */
  modes: Mode[];
  /** Live topics show a clock, statistics show a vintage or period. */
  freshnessKind: "clock" | "vintage";
  now?: NowPresence;
  /** Shipped in the UI. Unbuilt topics are declared so the IA is complete but stay hidden. */
  built: boolean;
}
