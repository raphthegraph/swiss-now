/**
 * The geo spine: municipalities keyed by BFS number (the join key for every statistic), with
 * canton and district, pinned to a vintage (municipality mergers take effect each 1 January).
 * Polygons live in `public/geo/ch-<vintage>.topo.json` (TopoJSON built from swissBOUNDARIES3D).
 */
import { z } from "zod";
import { CantonCode, LocalizedText } from "./common";

export const MunicipalityRef = z.object({
  /** BFS municipality number. */
  bfs: z.number().int().positive(),
  name: z.string().min(1),
  canton: CantonCode,
  district: z.number().int(),
  districtName: z.string().optional(),
});
export type MunicipalityRef = z.infer<typeof MunicipalityRef>;

export const GeoRegister = z.object({
  vintage: z.number().int().min(2000),
  /** `YYYY-MM-DD` the register was taken at. */
  date: z.string(),
  source: z.string(),
  attribution: z.string(),
  cantons: z.record(z.string(), z.object({ num: z.number().int(), name: z.string() })),
  municipalities: z.array(MunicipalityRef),
});
export type GeoRegister = z.infer<typeof GeoRegister>;

/** Objects in the TopoJSON file; ids are BFS numbers, district numbers and canton codes. */
export const GEO_OBJECTS = ["municipalities", "districts", "cantons", "lakes"] as const;
export type GeoObject = (typeof GEO_OBJECTS)[number];

/** Localized name helper for register entries (the register is monolingual German/local). */
export function municipalityLabel(m: MunicipalityRef): LocalizedText {
  return { de: m.name, en: m.name };
}
