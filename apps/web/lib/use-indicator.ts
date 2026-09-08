"use client";

import { useEffect, useState } from "react";
import { IndicatorCatalog, IndicatorSeries } from "@swiss-now/core/state";
import { dataUrl } from "@/lib/data-url";

const seriesCache = new Map<string, IndicatorSeries>();
let catalogPromise: Promise<IndicatorCatalog | undefined> | undefined;

/** The statistics catalogue (built by `build-data stats`), fetched once per session. */
export function useIndicatorCatalog(enabled: boolean): IndicatorCatalog | undefined {
  const [catalog, setCatalog] = useState<IndicatorCatalog | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    catalogPromise ??= fetch(dataUrl("stats/index.json"))
      .then((r) => (r.ok ? r.json() : undefined))
      .then((j: unknown) => (j ? IndicatorCatalog.parse(j) : undefined))
      .catch(() => undefined);
    let cancelled = false;
    void catalogPromise.then((c) => !cancelled && setCatalog(c));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return catalog;
}

/** One indicator's series file, cached per session. */
export function useIndicator(id: string | undefined): IndicatorSeries | undefined {
  const [series, setSeries] = useState<IndicatorSeries | undefined>(undefined);
  useEffect(() => {
    if (!id) return setSeries(undefined);
    const hit = seriesCache.get(id);
    if (hit) return setSeries(hit);
    let cancelled = false;
    fetch(dataUrl(`stats/${id}.json`))
      .then((r) => (r.ok ? r.json() : undefined))
      .then((j: unknown) => {
        if (cancelled || !j) return;
        const parsed = IndicatorSeries.safeParse(j);
        if (parsed.success) {
          seriesCache.set(id, parsed.data);
          setSeries(parsed.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);
  return series;
}
