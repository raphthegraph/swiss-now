/**
 * Aviation (expansion stage 6, gated): aircraft over Switzerland from community ADS-B receivers.
 * Positions are reported, not interpolated — the opposite of the trains — and rendered stepped.
 * The only source (adsb.fi) is personal-use only, so the topic stays hidden by the policy until
 * an agreement exists (docs/IA.md §7).
 */
import { z } from "zod";
import { ISODateTime, LonLat } from "./common";
import { LayerBase } from "./layers";

export const Aircraft = z.object({
  /** ICAO 24-bit address, hex */
  icao24: z.string().min(6),
  callsign: z.string().optional(),
  registration: z.string().optional(),
  type: z.string().optional(),
  lonLat: LonLat,
  altitudeM: z.number().optional(),
  trackDeg: z.number().min(0).max(360).optional(),
  groundSpeedKt: z.number().optional(),
  verticalRateMps: z.number().optional(),
  onGround: z.boolean(),
  observedAt: ISODateTime,
  positionKind: z.literal("reported"),
});
export type Aircraft = z.infer<typeof Aircraft>;

export const AviationState = LayerBase.extend({
  aircraft: z.array(Aircraft),
  /** radius around the country centre the feed was asked for, nautical miles */
  radiusNm: z.number(),
});
export type AviationState = z.infer<typeof AviationState>;
