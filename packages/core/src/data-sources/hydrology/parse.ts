import { z } from "zod";

/** SPARQL 1.1 JSON results, restricted to what the hydrology query returns. */
const Binding = z.object({ type: z.string(), value: z.string(), datatype: z.string().optional() });
const Row = z.object({
  station: Binding,
  name: Binding,
  identifier: Binding,
  type: Binding,
  waterBody: Binding.optional(),
  wkt: Binding,
  t: Binding,
  level: Binding.optional(),
  discharge: Binding.optional(),
  temp: Binding.optional(),
  danger: Binding,
});
export type HydroRow = z.infer<typeof Row>;

export const SparqlResults = z.object({
  head: z.object({ vars: z.array(z.string()) }),
  results: z.object({ bindings: z.array(Row) }),
});

export function parseHydroResults(json: unknown): HydroRow[] {
  return SparqlResults.parse(json).results.bindings;
}

const WKT_POINT = /^POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i;

export function parseWktPoint(wkt: string): [number, number] | undefined {
  const m = WKT_POINT.exec(wkt.trim());
  return m ? [Number(m[1]), Number(m[2])] : undefined;
}
