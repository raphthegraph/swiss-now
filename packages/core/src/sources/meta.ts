import { z } from "zod";
import { SourceId } from "./ids";

export const CommercialUse = z.enum(["yes", "ask", "no", "unresolved"]);
export type CommercialUse = z.infer<typeof CommercialUse>;

export const SourceMeta = z.object({
  id: SourceId,
  name: z.string(),
  provider: z.string(),
  /** Attribution string to show verbatim in credits and video end cards. */
  attribution: z.string(),
  url: z.url(),
  license: z.string(),
  commercialUse: CommercialUse,
  /** Expected update cadence in seconds; drives freshness and polling TTLs. */
  cadenceSeconds: z.number().int().positive(),
  /** Typical publication lag in seconds (observed 2026-09-07 where measured). */
  typicalLagSeconds: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
});
export type SourceMeta = z.infer<typeof SourceMeta>;
