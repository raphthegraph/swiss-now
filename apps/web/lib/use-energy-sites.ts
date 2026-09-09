"use client";

import { useEffect, useState } from "react";
import { PowerPlantsFile } from "@swiss-now/core/state";
import type { GridFile } from "@swiss-now/core/data-sources/bfe-plants";
import { dataUrl } from "@/lib/data-url";

export interface EnergySites {
  plants: PowerPlantsFile;
  grid: GridFile;
}
let promise: Promise<EnergySites | undefined> | undefined;

/** Plants ≥ 1 MW and the 220/380 kV grid (built weekly by `build-data energy`), fetched once. */
export function useEnergySites(enabled: boolean): EnergySites | undefined {
  const [sites, setSites] = useState<EnergySites | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    promise ??= Promise.all([
      fetch(dataUrl("energy/plants.json")).then((r) => (r.ok ? r.json() : undefined)),
      fetch(dataUrl("energy/grid.json")).then((r) => (r.ok ? r.json() : undefined)),
    ])
      .then(([p, g]: [unknown, unknown]) =>
        p && g ? { plants: PowerPlantsFile.parse(p), grid: g as GridFile } : undefined,
      )
      .catch(() => undefined);
    let cancelled = false;
    void promise.then((s) => !cancelled && setSites(s));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return sites;
}
