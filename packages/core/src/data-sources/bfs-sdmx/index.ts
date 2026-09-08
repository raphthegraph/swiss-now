/**
 * Swiss Stats Explorer SDMX REST API (BFS, OPEN BY, verified 2026-09-08): `format=csv`, keys in
 * DSD dimension order (else 404), always pin `_T` and `lastNObservations` (unfiltered queries
 * time out). GEO codes: BFS municipality numbers, canton codes, `8100` = Switzerland, `B_…` = districts.
 */
import { parse } from "csv-parse/sync";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const SDMX_BASE = "https://disseminate.stats.swiss/rest/data";

export interface SdmxRow {
  geo: string;
  period: string;
  value: number;
}

/** Reads an SDMX-CSV payload into geo/period/value rows; `geoColumn` names the geo dimension. */
export function parseSdmxCsv(
  csv: string,
  geoColumn: string,
  filter: (row: Record<string, string>) => boolean = () => true,
): SdmxRow[] {
  const rows = parse(csv.replace(/^﻿/, ""), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  const out: SdmxRow[] = [];
  for (const r of rows) {
    if (!filter(r)) continue;
    const value = Number(r["OBS_VALUE"]);
    const geo = r[geoColumn];
    const period = r["TIME_PERIOD"];
    if (!geo || !period || !Number.isFinite(value)) continue;
    out.push({ geo, period, value });
  }
  return out;
}

/** `8100` → `CH`; canton codes and municipality numbers pass through; districts are dropped. */
export function normalizeGeo(geo: string): string | undefined {
  if (geo === "8100") return "CH";
  if (/^B_/.test(geo)) return undefined;
  if (/^\d+$/.test(geo)) return String(Number(geo));
  if (/^[A-Z]{2}$/.test(geo)) return geo;
  return undefined;
}

export async function fetchSdmxCsv(
  flowKey: string,
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchFn(`${SDMX_BASE}/${flowKey}?${query}`, {
    // the server answers 500 "languageTag" without an Accept-Language header
    headers: { "user-agent": SWISS_NOW_USER_AGENT, "accept-language": "en" },
  });
  if (!res.ok) throw new Error(`sdmx ${res.status} ${flowKey}`);
  return res.text();
}

/** STATPOP permanent resident population, latest N years, every geo unit. */
export const STATPOP_FLOW = "CH1.STATPOP,DF_STATPOP_GEO_SEX_ZIVL_AGE5/._T._T._T.A";
/** Vacancy rate (Leerwohnungsziffer) in %, latest N years. */
export const LWZ_FLOW = "CH1.LWZ,DF_LWZ_1,1.0.0/._T._T..A";
