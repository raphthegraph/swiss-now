import { scaleStops, type ScaleStopsKey } from "../tokens/color";

/**
 * MapLibre `interpolate` colour expression built from the shared token stops, so the live map,
 * HUD legends and Remotion scenes derive colour from one definition.
 * Returned loosely typed (an expression array) so this package does not depend on maplibre-gl.
 */
export function maplibreColorExpression(property: string, key: ScaleStopsKey): unknown[] {
  const stops = scaleStops[key].flatMap(([value, color]) => [value, color]);
  return ["interpolate", ["linear"], ["get", property], ...stops];
}
