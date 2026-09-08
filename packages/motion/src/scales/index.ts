/**
 * Value → visual mappings. Built once from `scaleStops` so web legends and video legends match.
 * All scales clamp to their domain.
 */
import { scaleLinear, scaleSqrt, type ScaleLinear, type ScalePower } from "d3-scale";
import { interpolateLab } from "d3-interpolate";
import { scaleStops, type ScaleStopsKey } from "../tokens/color";

export type ColorScale = ScaleLinear<string, string>;

function colorScaleFromStops(key: ScaleStopsKey): ColorScale {
  const stops = scaleStops[key];
  return scaleLinear<string>()
    .domain(stops.map((s) => s[0]))
    .range(stops.map((s) => s[1]))
    .interpolate(interpolateLab)
    .clamp(true);
}

/** °C → colour. */
export const temperatureColor: ColorScale = colorScaleFromStops("temperature");
/** mm/h → colour (transparent below 0.5 mm/h). */
export const rainRateColor: ColorScale = colorScaleFromStops("rainRate");
/** discharge / seasonal normal → colour. */
export const dischargeRatioColor: ColorScale = colorScaleFromStops("dischargeRatio");
/** Danger level 1–5 → colour. */
export const dangerLevelColor: ColorScale = colorScaleFromStops("dangerLevel");
/** Delay seconds → colour (grey → Swiss red). */
export const delayColor: ColorScale = colorScaleFromStops("delay");
/** Yes share in %, diverging around 50. */
export const yesShareColor: ColorScale = colorScaleFromStops("yesShare");

/** Wind speed km/h → particle density factor 0–1 (0 below 3 km/h, 1 at 60 km/h and above). */
export const windParticleDensity: ScaleLinear<number, number> = scaleLinear()
  .domain([3, 60])
  .range([0, 1])
  .clamp(true);

/** Wind speed km/h → particle speed in px/s at zoom 7 (tuned visually; scaled by zoom in the layer). */
export const windParticleSpeed: ScaleLinear<number, number> = scaleLinear()
  .domain([0, 100])
  .range([2, 60])
  .clamp(true);

/**
 * Discharge relative to normal → flow animation speed factor. 1 at normal flow, ~0.35 at very low,
 * capped at 3 for floods so the animation stays legible.
 */
export const dischargeToFlowSpeed: ScaleLinear<number, number> = scaleLinear()
  .domain([0.25, 1, 4])
  .range([0.35, 1, 3])
  .clamp(true);

/** Delay seconds → pulse radius in px (0 below 2 min; grows with the square root of the delay). */
export const delayToPulseRadius: ScalePower<number, number> = scaleSqrt()
  .domain([120, 1800])
  .range([4, 28])
  .clamp(true);

/** Earthquake magnitude → number of concentric rings (1–5) and outer radius in km. */
export function magnitudeToRings(magnitude: number): { rings: number; radiusKm: number } {
  const m = Math.max(0, Math.min(7, magnitude));
  const rings = Math.max(1, Math.min(5, Math.round(m)));
  // felt radius grows roughly exponentially with magnitude; tuned for legibility, not physics
  const radiusKm = 4 * Math.pow(2, Math.max(0, m - 1));
  return { rings, radiusKm };
}

/** Legend ticks for a colour scale, useful for both HUD and video legends. */
export function legendTicks(key: ScaleStopsKey): { value: number; color: string }[] {
  return scaleStops[key].map(([value, color]) => ({ value, color }));
}

export * from "./maplibre";
