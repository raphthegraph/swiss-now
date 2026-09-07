import type { Freshness } from "@swiss-now/core";

/** How freshness alters rendering. Values are multipliers / flags applied by both renderers. */
export const freshnessStyle: Record<
  Freshness,
  { saturation: number; opacity: number; label: boolean; notice: boolean }
> = {
  live: { saturation: 1, opacity: 1, label: false, notice: false },
  aging: { saturation: 0.85, opacity: 0.95, label: false, notice: false },
  stale: { saturation: 0.55, opacity: 0.8, label: true, notice: false },
  outage: { saturation: 0.3, opacity: 0.55, label: true, notice: true },
};
