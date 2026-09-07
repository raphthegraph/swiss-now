/**
 * Freshness model. Derived from the age of the newest observation relative to the
 * source's expected cadence. See docs/ARCHITECTURE.md §9.
 */
import type { Freshness } from "../state/common";
import { getSource } from "../sources/registry";
import type { SourceId } from "../sources/ids";

export const FRESHNESS_MULTIPLIERS = {
  live: 1.5,
  aging: 3,
  stale: 12,
} as const;

/**
 * @param observedAt newest observation time, or `undefined` when nothing is available
 * @param cadenceSeconds expected publication cadence of the source
 * @param lagSeconds typical publication lag, subtracted before comparing (a 10-min feed that is
 *   always 9 min late is still live)
 * @param now reference time (defaults to the current time)
 */
export function computeFreshness(
  observedAt: string | Date | undefined,
  cadenceSeconds: number,
  lagSeconds = 0,
  now: Date = new Date(),
): Freshness {
  if (observedAt === undefined) return "outage";
  const observed = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return "outage";

  const ageSeconds = Math.max(0, (now.getTime() - observed.getTime()) / 1000 - lagSeconds);
  if (ageSeconds <= cadenceSeconds * FRESHNESS_MULTIPLIERS.live) return "live";
  if (ageSeconds <= cadenceSeconds * FRESHNESS_MULTIPLIERS.aging) return "aging";
  if (ageSeconds <= cadenceSeconds * FRESHNESS_MULTIPLIERS.stale) return "stale";
  return "outage";
}

/** Freshness for a source using the cadence and lag from the registry. */
export function freshnessForSource(
  sourceId: SourceId,
  observedAt: string | Date | undefined,
  now: Date = new Date(),
): Freshness {
  const meta = getSource(sourceId);
  return computeFreshness(observedAt, meta.cadenceSeconds, meta.typicalLagSeconds, now);
}

/** The worst freshness among several sources — a layer is only as fresh as its weakest input. */
export function worstFreshness(values: Freshness[]): Freshness {
  const order: Freshness[] = ["live", "aging", "stale", "outage"];
  let worst = 0;
  for (const v of values) worst = Math.max(worst, order.indexOf(v));
  return order[worst] ?? "outage";
}

/**
 * Cache TTL (seconds) for a layer response: the source cadence, bounded to keep CDN behaviour sane.
 * Used for `s-maxage`; stale-while-revalidate is 5× this value.
 */
export function ttlForCadence(cadenceSeconds: number): number {
  return Math.min(Math.max(cadenceSeconds, 60), 3600);
}
