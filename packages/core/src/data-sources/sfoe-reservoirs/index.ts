/**
 * SFOE storage-lake filling levels: one CSV since 2000 with GWh stored and the maximum per region,
 * every Sunday (opendata.swiss terms_by). Fetched server-side: the file allows no browser origin.
 */
import type { ReservoirRegion, ReservoirState } from "../../state/energy-sites";

export const RESERVOIR_URL = "https://www.bfe-ogd.ch/ogd17/ogd17_fuellungsgrad_speicherseen.csv";
const COLUMNS: [ReservoirRegion, string][] = [
  ["wallis", "Wallis"],
  ["graubuenden", "Graubuenden"],
  ["tessin", "Tessin"],
  ["uebrig", "UebrigCH"],
  ["total", "TotalCH"],
];

export function parseReservoirCsv(text: string, weeks = 110): ReservoirState | undefined {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0]?.split(",") ?? [];
  const col = (name: string) => header.indexOf(name);
  const rows = lines
    .slice(1)
    .map((l) => l.split(","))
    .filter((r) => r.length === header.length && /^\d{4}-\d{2}-\d{2}$/.test(r[0] ?? ""));
  const last = rows[rows.length - 1];
  if (!last) return undefined;
  const num = (r: string[], name: string) => Number(r[col(name)]);
  const regions = {} as ReservoirState["regions"];
  for (const [key, prefix] of COLUMNS)
    regions[key] = {
      gwh: num(last, `${prefix}_speicherinhalt_gwh`),
      maxGwh: num(last, `${prefix}_max_speicherinhalt_gwh`),
    };
  const series = rows.slice(-weeks).map((r) => ({
    date: r[0]!,
    gwh: num(r, "TotalCH_speicherinhalt_gwh"),
    maxGwh: num(r, "TotalCH_max_speicherinhalt_gwh"),
  }));
  return { date: last[0]!, regions, series };
}

export async function fetchReservoirs(fetchFn: typeof fetch = fetch): Promise<ReservoirState> {
  const res = await fetchFn(RESERVOIR_URL, { headers: { accept: "text/csv" } });
  if (!res.ok) throw new Error(`sfoe reservoirs ${res.status}`);
  const state = parseReservoirCsv(await res.text());
  if (!state) throw new Error("sfoe reservoirs: empty file");
  return state;
}
