/**
 * Politics: federal popular votes per municipality (BFS), vote metadata (swissvotes) and the
 * calendar of vote Sundays (Federal Chancellery via LINDAS). Results are static files built by
 * the data job; the state carries the latest vote Sunday and the index for the timeline.
 */
import { z } from "zod";
import { CantonCode, ISODateTime, LocalizedText } from "./common";
import { LayerBase } from "./layers";

/** swissvotes `rechtsform` 1–5. */
export const VoteKind = z.enum([
  "mandatory-referendum",
  "optional-referendum",
  "initiative",
  "counter-proposal",
  "tie-break",
]);
export type VoteKind = z.infer<typeof VoteKind>;

export const VoteShare = z.object({
  yesPct: z.number().min(0).max(100).nullable(),
  turnoutPct: z.number().min(0).max(100).nullable(),
});
export type VoteShare = z.infer<typeof VoteShare>;

export const VoteMeta = z.object({
  /** BFS cube id (swissvotes number × 10, +1/+2/+3 for initiative, counter-proposal, tie-break). */
  id: z.string().min(1),
  /** swissvotes vote number, when matched. */
  anr: z.number().optional(),
  /** `YYYY-MM-DD` vote Sunday. */
  date: z.string(),
  title: LocalizedText,
  kind: VoteKind.optional(),
  /** Federal Council recommendation from swissvotes. */
  councilRecommendation: z.enum(["yes", "no", "none"]).optional(),
  national: z
    .object({
      yesPct: z.number().nullable(),
      turnoutPct: z.number().nullable(),
      accepted: z.boolean().optional(),
      cantonsYes: z.number().optional(),
      cantonsNo: z.number().optional(),
    })
    .optional(),
});
export type VoteMeta = z.infer<typeof VoteMeta>;

export const VoteResult = z.object({
  schemaVersion: z.literal(1),
  meta: VoteMeta,
  status: z.enum(["final", "provisional", "pending"]),
  national: VoteShare,
  byCanton: z.partialRecord(CantonCode, VoteShare),
  /** keyed by BFS municipality number */
  byMunicipality: z.record(z.string(), VoteShare),
  /** geo vintage the municipality keys belong to */
  geoVintage: z.number().int(),
  source: z.string(),
  updatedAt: ISODateTime,
});
export type VoteResult = z.infer<typeof VoteResult>;

export const VoteDate = z.object({
  date: z.string(),
  /** number of proposals when known */
  proposals: z.number().int().optional(),
  /** LINDAS type: used, scheduled, blank (reserved), national-council-elections */
  type: z.enum(["used", "scheduled", "blank", "elections"]),
});
export type VoteDate = z.infer<typeof VoteDate>;

/** The index file the data job writes: recent votes newest first, plus the calendar. */
export const VoteIndex = z.object({
  schemaVersion: z.literal(1),
  generatedAt: ISODateTime,
  geoVintage: z.number().int(),
  votes: z.array(VoteMeta),
  dates: z.array(VoteDate),
});
export type VoteIndex = z.infer<typeof VoteIndex>;

export const PoliticsState = LayerBase.extend({
  /** the most recent vote Sunday with results */
  latestDate: z.string(),
  /** results of that Sunday's proposals */
  latest: z.array(VoteResult),
  /** recent votes for the timeline (newest first) */
  index: z.array(VoteMeta),
  /** upcoming scheduled vote Sundays */
  upcoming: z.array(VoteDate),
});
export type PoliticsState = z.infer<typeof PoliticsState>;
