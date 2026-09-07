/**
 * Provider schema for geo.admin.ch measurement GeoJSON. Stays inside this adapter.
 * Verified against live files on 2026-09-07: features carry the station code as `id`,
 * coordinates are EPSG:2056, `reference_ts` is ISO-8601 Z or the literal "-" when missing,
 * `altitude` is a numeric string, wind layers add `wind_direction` in degrees.
 */
import { z } from "zod";

const NumericString = z
  .string()
  .transform((s) => Number.parseFloat(s))
  .pipe(z.number());

export const GeoAdminFeature = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).transform(String),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z
    .object({
      station_name: z.string(),
      station_symbol: z.number().optional(),
      value: z.number().nullable(),
      unit: z.string(),
      reference_ts: z.union([z.iso.datetime({ offset: true }), z.literal("-")]),
      altitude: NumericString.optional(),
      measurement_height: z.string().optional(),
      wind_direction: z.number().optional(),
      description: z.string().optional(),
    })
    .loose(),
});
export type GeoAdminFeature = z.infer<typeof GeoAdminFeature>;

export const GeoAdminFeatureCollection = z.object({
  type: z.literal("FeatureCollection"),
  crs: z.object({ type: z.string(), properties: z.object({ name: z.string() }) }).optional(),
  license: z.string().optional(),
  mapname: z.string().optional(),
  creation_time: z.string().optional(),
  features: z.array(GeoAdminFeature),
});
export type GeoAdminFeatureCollection = z.infer<typeof GeoAdminFeatureCollection>;

export function parseGeoAdminLayer(json: unknown): GeoAdminFeatureCollection {
  return GeoAdminFeatureCollection.parse(json);
}
