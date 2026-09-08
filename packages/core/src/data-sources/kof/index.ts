/** KOF Economic Barometer (ETH Zurich, CC BY, monthly): `tsdb-api.kof.ethz.ch/v2/ts?keys=ch.kof.barometer&mime=csv`. */
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const KOF_BAROMETER_URL =
  "https://tsdb-api.kof.ethz.ch/v2/ts?keys=ch.kof.barometer&mime=csv&access_type=public";

export function parseKofCsv(csv: string): { periods: string[]; values: number[] } {
  const periods: string[] = [];
  const values: number[] = [];
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [date, v] = line.split(",");
    const n = Number(v);
    if (!date || !Number.isFinite(n)) continue;
    periods.push(date.slice(0, 7));
    values.push(Math.round(n * 100) / 100);
  }
  return { periods, values };
}

export async function fetchKofBarometer(fetchFn: typeof fetch = fetch) {
  const res = await fetchFn(KOF_BAROMETER_URL, { headers: { "user-agent": SWISS_NOW_USER_AGENT } });
  if (!res.ok) throw new Error(`kof ${res.status}`);
  return parseKofCsv(await res.text());
}
