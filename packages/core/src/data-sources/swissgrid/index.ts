/**
 * Swissgrid live chart feeds (verified 2026-09-08, undocumented, no key):
 * - import/export per border: `data.swissgrid.ch/getlivedata/importexport/?lang=en`
 *   markers carry "DE" + "409 MW" + an arrow direction relative to Switzerland; 20-min delay
 * - grid frequency: `data.swissgrid.ch/charts/frequency/?lang=en`, ~10 s samples
 * Tolerant parsing: a changed shape yields no values, and the layer reads as outage.
 */
import type { BorderCode } from "../../state/layers";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const SWISSGRID_IMPORT_EXPORT_URL =
  "https://data.swissgrid.ch/getlivedata/importexport/?lang=en";
export const SWISSGRID_FREQUENCY_URL = "https://data.swissgrid.ch/charts/frequency/?lang=en";

interface Marker {
  id?: string;
  text1?: string;
  text2?: string;
  direction?: string;
}
interface ImportExportJson {
  data?: { table?: { id?: string; label?: string }[]; marker?: Marker[] };
}
interface FrequencyJson {
  data?: {
    series?: { name?: string; data?: [number, number][] }[];
    table?: { id?: string; value?: string }[];
  };
  table?: { id?: string; value?: string }[];
}

/** An arrow pointing towards the country means import. */
const IMPORT_DIRECTION: Record<BorderCode, string> = {
  DE: "down",
  AT: "left",
  FR: "right",
  IT: "up",
};

/** Zurich wall-clock `08.09.2026 16:42:32` → ISO instant (handles CET/CEST). */
export function zurichToIso(s: string): string | undefined {
  const m = /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return undefined;
  const [, d, mo, y, h, mi, se] = m.map(Number) as [
    string,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const guess = Date.UTC(y, mo - 1, d, h, mi, se);
  const offset = zurichOffsetMinutes(guess);
  return new Date(guess - offset * 60_000).toISOString();
}

function zurichOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((local - utcMs) / 60_000);
}

export interface BorderFlows {
  /** MW, positive = import */
  flows: Partial<Record<BorderCode, number>>;
  netImportMW: number | undefined;
  observedAt: string | undefined;
}

export function parseImportExport(json: ImportExportJson): BorderFlows {
  const flows: Partial<Record<BorderCode, number>> = {};
  for (const m of json.data?.marker ?? []) {
    const code = (m.text1 ?? m.id ?? "").toUpperCase() as BorderCode;
    if (!(code in IMPORT_DIRECTION)) continue;
    const mw = Number(/([\d.]+)\s*MW/.exec(m.text2 ?? "")?.[1]);
    if (!Number.isFinite(mw)) continue;
    flows[code] = m.direction === IMPORT_DIRECTION[code] ? mw : -mw;
  }
  const ts = json.data?.table?.find((t) => t.id === "timestamp")?.label ?? "";
  const values = Object.values(flows);
  return {
    flows,
    netImportMW: values.length ? values.reduce((a, b) => a + b, 0) : undefined,
    observedAt: zurichToIso(ts),
  };
}

export interface FrequencySample {
  hz: number;
  observedAt: string;
  gridTimeDeviationS: number | undefined;
  /** last minutes of samples, [ms, Hz] */
  series: [number, number][];
}

export function parseFrequency(json: FrequencyJson): FrequencySample | undefined {
  const series = json.data?.series?.[0]?.data ?? [];
  const last = series[series.length - 1];
  if (!last) return undefined;
  const dev = Number(
    /(-?[\d.]+)\s*s/.exec(
      (json.table ?? json.data?.table)?.find((t) => t.id === "GridTimeDeviation")?.value ?? "",
    )?.[1],
  );
  return {
    hz: last[1],
    observedAt: new Date(last[0]).toISOString(),
    gridTimeDeviationS: Number.isFinite(dev) ? dev : undefined,
    series,
  };
}

const headers = { "user-agent": SWISS_NOW_USER_AGENT, accept: "application/json" };
export async function fetchImportExport(fetchFn: typeof fetch = fetch): Promise<BorderFlows> {
  const res = await fetchFn(SWISSGRID_IMPORT_EXPORT_URL, { headers });
  if (!res.ok) throw new Error(`swissgrid ${res.status}`);
  return parseImportExport((await res.json()) as ImportExportJson);
}
export async function fetchFrequency(
  fetchFn: typeof fetch = fetch,
): Promise<FrequencySample | undefined> {
  const res = await fetchFn(SWISSGRID_FREQUENCY_URL, { headers });
  if (!res.ok) throw new Error(`swissgrid frequency ${res.status}`);
  return parseFrequency((await res.json()) as FrequencyJson);
}
