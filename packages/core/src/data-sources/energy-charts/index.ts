/**
 * Energy-Charts (Fraunhofer ISE), CC BY 4.0, verified 2026-09-08. Rate limit 2 requests/min —
 * the web app fetches through the Data Cache every 15 minutes. No CORS: server-side only.
 * - `public_power?country=ch` hourly production by type (Swiss zone has no wind/solar series)
 * - `v2/price_current?bzn=CH` day-ahead price of the current hour
 */
import type { GenerationType } from "../../state/layers";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const ENERGY_CHARTS_BASE = "https://api.energy-charts.info";

const TYPE_BY_NAME: Record<string, GenerationType> = {
  Nuclear: "nuclear",
  "Hydro Run-of-River": "runOfRiver",
  "Hydro water reservoir": "reservoir",
  "Hydro pumped storage": "pumpedStorage",
  "Wind onshore": "wind",
  Solar: "solar",
  Others: "others",
  "Cross border electricity trading": "crossBorder",
};

interface PublicPowerJson {
  unix_seconds?: number[];
  production_types?: { name: string; data: (number | null)[] }[];
}

export interface GenerationSeries {
  unixSeconds: number[];
  byTypeMW: Partial<Record<GenerationType, (number | null)[]>>;
  renewableSharePct: (number | null)[];
}

export function parsePublicPower(json: PublicPowerJson): GenerationSeries {
  const unixSeconds = json.unix_seconds ?? [];
  const byTypeMW: GenerationSeries["byTypeMW"] = {};
  let renewableSharePct: (number | null)[] = unixSeconds.map(() => null);
  for (const p of json.production_types ?? []) {
    const type = TYPE_BY_NAME[p.name];
    if (type) byTypeMW[type] = p.data;
    else if (p.name === "Renewable share of generation") renewableSharePct = p.data;
  }
  return { unixSeconds, byTypeMW, renewableSharePct };
}

/** The last hour with a nuclear value (the series carries hours ahead as null). */
export function latestGeneration(s: GenerationSeries):
  | {
      observedAt: string;
      byTypeMW: Partial<Record<GenerationType, number>>;
      renewableSharePct: number | undefined;
    }
  | undefined {
  const ref = s.byTypeMW.nuclear ?? s.byTypeMW.runOfRiver ?? [];
  let i = ref.length - 1;
  while (i >= 0 && ref[i] === null) i--;
  if (i < 0) return undefined;
  const byTypeMW: Partial<Record<GenerationType, number>> = {};
  for (const [type, arr] of Object.entries(s.byTypeMW) as [GenerationType, (number | null)[]][]) {
    const v = arr[i];
    if (typeof v === "number") byTypeMW[type] = v;
  }
  const share = s.renewableSharePct[i];
  return {
    observedAt: new Date(s.unixSeconds[i]! * 1000).toISOString(),
    byTypeMW,
    renewableSharePct: typeof share === "number" ? share : undefined,
  };
}

interface PriceCurrentJson {
  data?: { timestamp: string; values: { day_ahead_price?: number } }[];
  attributes?: { valid_until?: string };
}

export function parsePriceCurrent(
  json: PriceCurrentJson,
): { eurPerMWh: number; hour: string; validUntil?: string } | undefined {
  const row = json.data?.[0];
  const v = row?.values.day_ahead_price;
  if (!row || typeof v !== "number") return undefined;
  const out: { eurPerMWh: number; hour: string; validUntil?: string } = {
    eurPerMWh: v,
    hour: new Date(row.timestamp).toISOString(),
  };
  if (json.attributes?.valid_until)
    out.validUntil = new Date(json.attributes.valid_until).toISOString();
  return out;
}

const headers = { "user-agent": SWISS_NOW_USER_AGENT, accept: "application/json" };
/** Hourly mix from `hoursBack` hours before `now` (Energy-Charts expects local ISO without zone). */
export function publicPowerUrl(now: Date, hoursBack = 24): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  const start = new Date(now.getTime() - hoursBack * 3_600_000);
  return `${ENERGY_CHARTS_BASE}/public_power?country=ch&start=${fmt(start)}&end=${fmt(now)}`;
}
export async function fetchPublicPower(
  fetchFn: typeof fetch = fetch,
  now = new Date(),
): Promise<GenerationSeries> {
  const res = await fetchFn(publicPowerUrl(now), { headers });
  if (!res.ok) throw new Error(`energy-charts public_power ${res.status}`);
  return parsePublicPower((await res.json()) as PublicPowerJson);
}
export async function fetchPriceCurrent(fetchFn: typeof fetch = fetch) {
  const res = await fetchFn(`${ENERGY_CHARTS_BASE}/v2/price_current?bzn=CH`, { headers });
  if (!res.ok) throw new Error(`energy-charts price ${res.status}`);
  return parsePriceCurrent((await res.json()) as PriceCurrentJson);
}
