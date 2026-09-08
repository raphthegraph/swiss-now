/**
 * Hazards (expansion stage 3): forest-fire danger regions (BAFU, daily), avalanche bulletin
 * regions (SLF, winter), IMIS snow stations (SLF, 30 min), hail (MeteoSwiss MESHS, 5 min in
 * season). Earthquakes stay in SeismicState; the HAZARDS topic composes both.
 */
import { z } from "zod";
import { ISODateTime, LocalizedText, CantonCode } from "./common";
import { Field, Observation, Station } from "./entities";
import { LayerBase } from "./layers";

export const DangerRegion = z.object({
  id: z.string(),
  name: LocalizedText,
  canton: CantonCode.optional(),
  /** Swiss danger scale 1–5 */
  level: z.number().int().min(1).max(5),
  validFrom: ISODateTime.optional(),
  validUntil: ISODateTime.optional(),
});
export type DangerRegion = z.infer<typeof DangerRegion>;

export const HazardsState = LayerBase.extend({
  fireDanger: z.object({
    regions: z.array(DangerRegion),
    /** GeoJSON (WGS84) of the region polygons with `id` and `level` properties */
    geojsonUrl: z.string(),
    issuedAt: ISODateTime.optional(),
  }),
  avalanche: z.object({
    regions: z.array(DangerRegion),
    geojsonUrl: z.string(),
    /** empty in summer: the bulletin is not issued */
    inSeason: z.boolean(),
  }),
  snow: z.object({ stations: z.array(Station), observations: z.array(Observation) }),
  /** newest hail product frame, when hail was detected in the last hour */
  hail: Field.optional(),
  hailInSeason: z.boolean(),
});
export type HazardsState = z.infer<typeof HazardsState>;
