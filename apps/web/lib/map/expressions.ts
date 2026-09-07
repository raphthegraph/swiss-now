import type { ExpressionSpecification } from "maplibre-gl";
import { maplibreColorExpression } from "@swiss-now/motion/scales";
import type { ScaleStopsKey } from "@swiss-now/motion/tokens";

/** Typed wrapper around the shared expression builder from @swiss-now/motion. */
export function colorExpression(property: string, key: ScaleStopsKey): ExpressionSpecification {
  return maplibreColorExpression(property, key) as ExpressionSpecification;
}
