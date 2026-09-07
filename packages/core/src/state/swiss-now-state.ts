import { z } from "zod";
import { Freshness, ISODateTime, LayerId } from "./common";
import {
  AirState,
  EnergyState,
  HydrologyState,
  RailState,
  SeismicState,
  TrafficState,
  WeatherState,
} from "./layers";
import { Summary } from "./summary";
import { SourceMeta } from "../sources/meta";

/**
 * The composite state. The web client assembles it from per-layer responses;
 * Remotion loads it from a fixture or a snapshot file. Optional layers arrive in later phases.
 */
export const SwissNowState = z.object({
  schemaVersion: z.literal(1),
  generatedAt: ISODateTime,
  freshness: z.partialRecord(LayerId, Freshness),
  weather: WeatherState,
  hydrology: HydrologyState,
  rail: RailState.optional(),
  seismic: SeismicState.optional(),
  traffic: TrafficState.optional(),
  air: AirState.optional(),
  energy: EnergyState.optional(),
  summary: Summary,
  meta: z.object({ sources: z.array(SourceMeta) }),
});
export type SwissNowState = z.infer<typeof SwissNowState>;
