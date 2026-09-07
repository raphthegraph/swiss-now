import type { ExpressionSpecification } from "maplibre-gl";
import { scaleStops, type ScaleStopsKey } from "@swiss-now/motion/tokens";

/**
 * Builds a MapLibre `interpolate` colour expression from the shared token stops, so the map,
 * the HUD legend and the Remotion scenes all derive colour from the same definition.
 */
export function colorExpression(property: string, key: ScaleStopsKey): ExpressionSpecification {
  const stops = scaleStops[key].flatMap(([value, color]) => [value, color]);
  return ["interpolate", ["linear"], ["get", property], ...stops] as ExpressionSpecification;
}
