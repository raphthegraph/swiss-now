import { z } from "zod";
import { ISODateTime, LonLat } from "./common";

/** Plant types on the energy map, folded from the register's categories. */
export const PowerPlantType = z.enum([
  "hydro-storage",
  "hydro-pumped",
  "hydro-run",
  "nuclear",
  "solar",
  "wind",
  "biomass",
  "waste",
  "gas",
  "other",
]);
export type PowerPlantType = z.infer<typeof PowerPlantType>;

export const PowerPlant = z.object({
  id: z.string().min(1),
  /** WASTA name for hydro plants; the municipality otherwise */
  name: z.string().min(1),
  municipality: z.string(),
  canton: z.string(),
  type: PowerPlantType,
  /** total installed power in kW */
  kw: z.number().nonnegative(),
  /** year of commissioning */
  since: z.number().int().optional(),
  lonLat: LonLat,
});
export type PowerPlant = z.infer<typeof PowerPlant>;

export const PowerPlantsFile = z.object({
  schemaVersion: z.literal(1),
  generatedAt: ISODateTime,
  /** the register's minimum power kept, in kW */
  minKw: z.number(),
  attribution: z.string(),
  plants: z.array(PowerPlant),
});
export type PowerPlantsFile = z.infer<typeof PowerPlantsFile>;

/** Properties of one grid line in the simplified GeoJSON file. */
export const GridLineProps = z.object({
  kv: z.number(),
  name: z.string().optional(),
  owner: z.string().optional(),
});
export type GridLineProps = z.infer<typeof GridLineProps>;

/** Storage lakes: GWh stored against the maximum, per region, the latest week and the recent course. */
export const ReservoirRegion = z.enum(["wallis", "graubuenden", "tessin", "uebrig", "total"]);
export type ReservoirRegion = z.infer<typeof ReservoirRegion>;
export const ReservoirLevel = z.object({ gwh: z.number(), maxGwh: z.number() });
export const ReservoirState = z.object({
  /** the Sunday the level refers to */
  date: z.string(),
  regions: z.record(ReservoirRegion, ReservoirLevel),
  /** weekly totals, oldest → newest (about two years) */
  series: z.array(z.object({ date: z.string(), gwh: z.number(), maxGwh: z.number() })),
});
export type ReservoirState = z.infer<typeof ReservoirState>;
