/**
 * Statistics (expansion stage 4): one static file per indicator, built by `build-data stats`
 * from the BFS platforms and national series. Values are keyed by BFS municipality number,
 * canton code or `CH`, per period; the web joins them to the geo spine.
 */
import { z } from "zod";
import { ISODateTime, LocalizedText } from "./common";
import { SourceId } from "../sources/ids";
import { TopicId } from "../topics/spec";

export const IndicatorGeoLevel = z.enum(["municipality", "canton", "country"]);
export type IndicatorGeoLevel = z.infer<typeof IndicatorGeoLevel>;

export const IndicatorMeta = z.object({
  id: z.string().min(1),
  topic: TopicId,
  label: LocalizedText,
  unit: z.string(),
  decimals: z.number().int().min(0).max(3),
  geoLevel: IndicatorGeoLevel,
  periodKind: z.enum(["year", "month", "quarter"]),
  source: SourceId,
  /** cube or dataflow id, for the credits and the rebuild */
  cube: z.string(),
  attribution: z.string(),
  publishedAt: ISODateTime,
  /** municipality vintage the keys belong to (municipality indicators) */
  geoVintage: z.number().int().optional(),
  /** how the map colours it */
  scale: z.enum(["sequential", "diverging"]).default("sequential"),
  /** sequential ramps run low → high; for "lower is better" indicators the legend says so */
  higherIsBetter: z.boolean().optional(),
});
export type IndicatorMeta = z.infer<typeof IndicatorMeta>;

export const IndicatorSeries = z.object({
  schemaVersion: z.literal(1),
  meta: IndicatorMeta,
  /** oldest → newest: `2025`, `2026-07`, `2026-Q2` */
  periods: z.array(z.string()).min(1),
  /** geo key → one value per period (null = not available) */
  values: z.record(z.string(), z.array(z.number().nullable())),
});
export type IndicatorSeries = z.infer<typeof IndicatorSeries>;

export const IndicatorCatalog = z.object({
  schemaVersion: z.literal(1),
  generatedAt: ISODateTime,
  indicators: z.array(IndicatorMeta),
});
export type IndicatorCatalog = z.infer<typeof IndicatorCatalog>;

/** Latest non-null value per key. */
export function latestValues(s: IndicatorSeries): {
  period: string;
  values: Record<string, number>;
} {
  const out: Record<string, number> = {};
  let period = s.periods[s.periods.length - 1]!;
  for (const [key, arr] of Object.entries(s.values)) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = arr[i];
      if (typeof v === "number") {
        out[key] = v;
        if (i < s.periods.length) period = s.periods[i]!;
        break;
      }
    }
  }
  return { period, values: out };
}
