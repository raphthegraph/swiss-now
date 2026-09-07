import type { Parameter } from "../../state/entities";

/**
 * geo.admin.ch pre-rendered MeteoSwiss measurement layers (5-minute refresh).
 * Verified 2026-09-07 via api3.geo.admin.ch layersConfig. Not a documented API contract:
 * the OGD CSVs (VQHA80.csv) remain the fallback.
 */
export const GEOADMIN_MEASUREMENT_LAYERS = {
  "ch.meteoschweiz.messwerte-lufttemperatur-10min": { parameter: "airTemperature", unit: "°C" },
  "ch.meteoschweiz.messwerte-niederschlag-10min": { parameter: "precipitation10min", unit: "mm" },
  "ch.meteoschweiz.messwerte-niederschlag-1h": { parameter: "precipitation1h", unit: "mm" },
  "ch.meteoschweiz.messwerte-niederschlag-24h": { parameter: "precipitation24h", unit: "mm" },
  "ch.meteoschweiz.messwerte-wind-boeenspitze-kmh-10min": { parameter: "windGust", unit: "km/h" },
  "ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min": {
    parameter: "windSpeed",
    unit: "km/h",
  },
  "ch.meteoschweiz.messwerte-schneehoehe-automatisch-10min": { parameter: "snowDepth", unit: "cm" },
  "ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min": { parameter: "relativeHumidity", unit: "%" },
  "ch.meteoschweiz.messwerte-taupunkt-10min": { parameter: "dewPoint", unit: "°C" },
  "ch.meteoschweiz.messwerte-globalstrahlung-10min": { parameter: "globalRadiation", unit: "W/m²" },
  "ch.meteoschweiz.messwerte-sonnenscheindauer-10min": {
    parameter: "sunshineDuration10min",
    unit: "min",
  },
  "ch.meteoschweiz.messwerte-foehn-10min": { parameter: "foehnIndex", unit: "" },
} as const satisfies Record<string, { parameter: Parameter; unit: string }>;

export type GeoAdminMeasurementLayerId = keyof typeof GEOADMIN_MEASUREMENT_LAYERS;

/** The layers fetched for the MVP weather state (Phase 0). More join in Phase 1. */
export const WEATHER_LAYERS_MVP: GeoAdminMeasurementLayerId[] = [
  "ch.meteoschweiz.messwerte-lufttemperatur-10min",
  "ch.meteoschweiz.messwerte-niederschlag-10min",
  "ch.meteoschweiz.messwerte-niederschlag-1h",
  "ch.meteoschweiz.messwerte-niederschlag-24h",
  "ch.meteoschweiz.messwerte-wind-boeenspitze-kmh-10min",
  "ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min",
  "ch.meteoschweiz.messwerte-schneehoehe-automatisch-10min",
  "ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min",
];

export type GeoAdminLang = "de" | "fr" | "it" | "en";

export function geoAdminLayerUrl(
  layerId: GeoAdminMeasurementLayerId,
  lang: GeoAdminLang = "en",
): string {
  return `https://data.geo.admin.ch/${layerId}/${layerId}_${lang}.json`;
}
