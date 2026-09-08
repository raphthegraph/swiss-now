/** PxWeb cubes read as indicators: STATENT jobs per municipality, HESTA hotel nights per canton. */
import { categoryCodes, pxwebQuery, valueAt, type FetchLike, type JsonStat2 } from "./client";

export const STATENT_CUBE = "px-x-0602010000_102";
export const HESTA_CUBE = "px-x-1003020000_102";

const CANTON_BY_NUM: Record<string, string> = {
  "1": "ZH",
  "2": "BE",
  "3": "LU",
  "4": "UR",
  "5": "SZ",
  "6": "OW",
  "7": "NW",
  "8": "GL",
  "9": "ZG",
  "10": "FR",
  "11": "SO",
  "12": "BS",
  "13": "BL",
  "14": "SH",
  "15": "AR",
  "16": "AI",
  "17": "SG",
  "18": "GR",
  "19": "AG",
  "20": "TG",
  "21": "TI",
  "22": "VD",
  "23": "VS",
  "24": "NE",
  "25": "GE",
  "26": "JU",
};

export interface IndicatorRows {
  periods: string[];
  values: Record<string, (number | null)[]>;
}

/** Full-time-equivalent jobs (all sectors) per municipality for one year; `99999` = CH. */
export function parseStatent(d: JsonStat2): IndicatorRows {
  const years = categoryCodes(d, "Jahr");
  const munis = categoryCodes(d, "Gemeinde");
  const sectors = categoryCodes(d, "Wirtschaftssektor");
  const units = categoryCodes(d, "Beobachtungseinheit");
  const iY = d.id.indexOf("Jahr");
  const iG = d.id.indexOf("Gemeinde");
  const iS = d.id.indexOf("Wirtschaftssektor");
  const iU = d.id.indexOf("Beobachtungseinheit");
  const sector = sectors.indexOf("999");
  const unit = units.indexOf("5") >= 0 ? units.indexOf("5") : 0;
  const values: Record<string, (number | null)[]> = {};
  munis.forEach((code, g) => {
    const key = code === "99999" ? "CH" : String(Number(code));
    values[key] = years.map((_, y) => {
      const pos: number[] = [];
      pos[iY] = y;
      pos[iG] = g;
      pos[iS] = Math.max(0, sector);
      pos[iU] = unit;
      return valueAt(d, pos);
    });
  });
  return { periods: years, values };
}

/** Hotel overnight stays (all origins) per canton and month; `8100` = CH. Months in the future are null. */
export function parseHesta(d: JsonStat2): IndicatorRows {
  const years = categoryCodes(d, "Jahr");
  const months = categoryCodes(d, "Monat").filter((m) => m !== "YYYY");
  const cantons = categoryCodes(d, "Kanton");
  const iY = d.id.indexOf("Jahr");
  const iM = d.id.indexOf("Monat");
  const iK = d.id.indexOf("Kanton");
  const iH = d.id.indexOf("Herkunftsland");
  const iI = d.id.indexOf("Indikator");
  const monthsAll = categoryCodes(d, "Monat");
  const periods: string[] = [];
  const cells: { y: number; m: number }[] = [];
  years.forEach((y, yi) =>
    months.forEach((m) => {
      periods.push(`${y}-${m.padStart(2, "0")}`);
      cells.push({ y: yi, m: monthsAll.indexOf(m) });
    }),
  );
  const values: Record<string, (number | null)[]> = {};
  cantons.forEach((code, k) => {
    const key = code === "8100" ? "CH" : (CANTON_BY_NUM[code] ?? code);
    values[key] = cells.map(({ y, m }) => {
      const pos: number[] = [];
      pos[iY] = y;
      pos[iM] = m;
      pos[iK] = k;
      if (iH >= 0) pos[iH] = 0;
      if (iI >= 0) pos[iI] = 0;
      return valueAt(d, pos);
    });
  });
  // drop trailing months with no data at all
  let last = periods.length - 1;
  while (last > 0 && Object.values(values).every((arr) => arr[last] === null)) last--;
  for (const key of Object.keys(values)) values[key] = values[key]!.slice(0, last + 1);
  return { periods: periods.slice(0, last + 1), values };
}

export async function fetchStatent(
  year: string,
  fetchFn: FetchLike = fetch,
): Promise<IndicatorRows> {
  const d = await pxwebQuery(
    STATENT_CUBE,
    "de",
    [
      { code: "Jahr", selection: { filter: "item", values: [year] } },
      { code: "Gemeinde", selection: { filter: "all", values: ["*"] } },
      { code: "Wirtschaftssektor", selection: { filter: "item", values: ["999"] } },
      { code: "Beobachtungseinheit", selection: { filter: "item", values: ["5"] } },
    ],
    fetchFn,
  );
  return parseStatent(d);
}

export async function fetchHesta(
  years: string[],
  fetchFn: FetchLike = fetch,
): Promise<IndicatorRows> {
  const d = await pxwebQuery(
    HESTA_CUBE,
    "de",
    [
      { code: "Jahr", selection: { filter: "item", values: years } },
      {
        code: "Monat",
        selection: {
          filter: "item",
          values: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
        },
      },
      { code: "Kanton", selection: { filter: "all", values: ["*"] } },
      { code: "Herkunftsland", selection: { filter: "item", values: ["00"] } },
      { code: "Indikator", selection: { filter: "item", values: ["2"] } },
    ],
    fetchFn,
  );
  return parseHesta(d);
}
