/**
 * Indicator builders: each returns an `IndicatorSeries` ready to be written as a static file.
 * Keys follow the geo spine (BFS number, canton code, `CH`).
 */
import type { IndicatorMeta, IndicatorSeries } from "../../state/stats";
import {
  fetchSdmxCsv,
  normalizeGeo,
  parseSdmxCsv,
  LWZ_FLOW,
  STATPOP_FLOW,
} from "../bfs-sdmx/index";
import { fetchHesta, fetchStatent, type IndicatorRows } from "../bfs-pxweb/indicators";
import { fetchKofBarometer } from "../kof/index";

const series = (meta: IndicatorMeta, rows: IndicatorRows): IndicatorSeries => ({
  schemaVersion: 1,
  meta,
  periods: rows.periods,
  values: rows.values,
});

/** Rows (geo, period, value) → periods × keys table. */
export function pivot(
  rows: { geo: string; period: string; value: number }[],
  keyOf: (geo: string) => string | undefined = normalizeGeo,
): IndicatorRows {
  const periods = [...new Set(rows.map((r) => r.period))].sort();
  const idx = new Map(periods.map((p, i) => [p, i]));
  const values: Record<string, (number | null)[]> = {};
  for (const r of rows) {
    const key = keyOf(r.geo);
    if (!key) continue;
    const arr = values[key] ?? (values[key] = periods.map(() => null));
    arr[idx.get(r.period)!] = r.value;
  }
  return { periods, values };
}

export async function buildPopulation(
  now: Date,
  geoVintage: number,
  fetchFn: typeof fetch = fetch,
): Promise<IndicatorSeries> {
  const csv = await fetchSdmxCsv(STATPOP_FLOW, "lastNObservations=3&format=csv", fetchFn);
  const rows = pivot(parseSdmxCsv(csv, "GEO"));
  return series(
    {
      id: "population",
      topic: "population",
      label: {
        de: "Ständige Wohnbevölkerung",
        en: "Permanent resident population",
        fr: "Population résidante permanente",
        it: "Popolazione residente permanente",
      },
      unit: "",
      decimals: 0,
      geoLevel: "municipality",
      periodKind: "year",
      source: "bfs-sdmx",
      cube: "CH1.STATPOP/DF_STATPOP_GEO_SEX_ZIVL_AGE5",
      attribution: "Source: BFS STATPOP",
      publishedAt: now.toISOString(),
      geoVintage,
      scale: "sequential",
    },
    rows,
  );
}

export async function buildVacancy(
  now: Date,
  geoVintage: number,
  fetchFn: typeof fetch = fetch,
): Promise<IndicatorSeries> {
  const csv = await fetchSdmxCsv(LWZ_FLOW, "lastNObservations=3&format=csv", fetchFn);
  const rows = pivot(parseSdmxCsv(csv, "GR_KT_GDE", (r) => r["MEASURE_DIMENSION"] === "PC"));
  return series(
    {
      id: "vacancy-rate",
      topic: "housing",
      label: {
        de: "Leerwohnungsziffer",
        en: "Vacancy rate",
        fr: "Taux de logements vacants",
        it: "Tasso di abitazioni vuote",
      },
      unit: "%",
      decimals: 2,
      geoLevel: "municipality",
      periodKind: "year",
      source: "bfs-sdmx",
      cube: "CH1.LWZ/DF_LWZ_1",
      attribution: "Source: BFS",
      publishedAt: now.toISOString(),
      geoVintage,
      scale: "sequential",
      higherIsBetter: true,
    },
    rows,
  );
}

export async function buildJobs(
  now: Date,
  geoVintage: number,
  year: string,
  fetchFn: typeof fetch = fetch,
): Promise<IndicatorSeries> {
  return series(
    {
      id: "jobs-fte",
      topic: "economy",
      label: {
        de: "Vollzeitäquivalente",
        en: "Full-time-equivalent jobs",
        fr: "Équivalents plein temps",
        it: "Equivalenti a tempo pieno",
      },
      unit: "",
      decimals: 0,
      geoLevel: "municipality",
      periodKind: "year",
      source: "bfs-pxweb",
      cube: "px-x-0602010000_102",
      attribution: "Source: BFS STATENT",
      publishedAt: now.toISOString(),
      geoVintage,
      scale: "sequential",
    },
    await fetchStatent(year, fetchFn),
  );
}

export async function buildOvernightStays(
  now: Date,
  years: string[],
  fetchFn: typeof fetch = fetch,
): Promise<IndicatorSeries> {
  return series(
    {
      id: "overnight-stays",
      topic: "tourism",
      label: {
        de: "Hotellogiernächte",
        en: "Hotel overnight stays",
        fr: "Nuitées hôtelières",
        it: "Pernottamenti alberghieri",
      },
      unit: "",
      decimals: 0,
      geoLevel: "canton",
      periodKind: "month",
      source: "bfs-pxweb",
      cube: "px-x-1003020000_102",
      attribution: "Source: BFS HESTA",
      publishedAt: now.toISOString(),
      scale: "sequential",
    },
    await fetchHesta(years, fetchFn),
  );
}

export async function buildKofBarometer(
  now: Date,
  fetchFn: typeof fetch = fetch,
): Promise<IndicatorSeries> {
  const k = await fetchKofBarometer(fetchFn);
  const keep = 120; // ten years
  return series(
    {
      id: "kof-barometer",
      topic: "economy",
      label: {
        de: "KOF Konjunkturbarometer",
        en: "KOF Economic Barometer",
        fr: "Baromètre conjoncturel KOF",
        it: "Barometro congiunturale KOF",
      },
      unit: "",
      decimals: 1,
      geoLevel: "country",
      periodKind: "month",
      source: "kof",
      cube: "ch.kof.barometer",
      attribution: "Source: KOF ETH Zurich",
      publishedAt: now.toISOString(),
      scale: "sequential",
    },
    { periods: k.periods.slice(-keep), values: { CH: k.values.slice(-keep) } },
  );
}
