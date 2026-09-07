/** National and per-canton key figures shown in the summary strip and used by the story builder. */
import { z } from "zod";
import { CantonCode, ISODateTime, LayerId, LocalizedText } from "./common";

export const KPI = z.object({
  id: z.string().min(1),
  layer: LayerId,
  label: LocalizedText,
  value: z.number(),
  unit: z.string(),
  /** Value considered normal for this date/time, when known (drives "unusual" ranking). */
  baseline: z.number().optional(),
  /** Standard deviations from baseline, when a baseline exists. */
  anomalyScore: z.number().optional(),
  observedAt: ISODateTime,
  /** Optional reference to the station/event that produced the value. */
  ref: z.string().optional(),
});
export type KPI = z.infer<typeof KPI>;

export const Summary = z.object({
  generatedAt: ISODateTime,
  national: z.array(KPI),
  byCanton: z.partialRecord(CantonCode, z.array(KPI)).default({}),
});
export type Summary = z.infer<typeof Summary>;
