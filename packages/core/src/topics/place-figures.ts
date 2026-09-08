/**
 * Figures for one place (COMPARE mode): a municipality or canton, by BFS number or code.
 * Statistics and politics read the place's own row; live topics are handled by the web app
 * from the nearest stations (they carry coordinates, not keys).
 */
import { FL, t } from "../i18n";
import type { LocalizedText } from "../state/common";
import type { IndicatorSeries } from "../state/stats";
import type { VoteResult } from "../state/politics";
import { latestValues } from "../state/stats";
import type { Figure } from "./figures";

const fig = (
  id: string,
  label: LocalizedText,
  value: number,
  decimals: number,
  rest: { unit?: string; text?: string; where?: string } = {},
): Figure => {
  const f: Figure = { id, label, value, decimals };
  if (rest.unit !== undefined) f.unit = rest.unit;
  if (rest.text !== undefined) f.text = rest.text;
  if (rest.where !== undefined) f.where = rest.where;
  return f;
};

/** Rank of `key` among all places (1 = highest) and the count. */
/** Keys of one geo level: municipalities are numbers, cantons two-letter codes. */
export function sameLevel(key: string): (k: string) => boolean {
  const canton = /^[A-Z]{2}$/.test(key);
  return (k) => k !== "CH" && /^[A-Z]{2}$/.test(k) === canton;
}

export function rankOf(
  values: Record<string, number>,
  key: string,
): { rank: number; of: number } | undefined {
  const entries = Object.entries(values).filter(([k]) => sameLevel(key)(k));
  const v = values[key];
  if (v === undefined) return undefined;
  const rank = 1 + entries.filter(([, x]) => x > v).length;
  return { rank, of: entries.length };
}

export function indicatorPlaceFigures(
  series: IndicatorSeries,
  key: string,
  period?: string,
): Figure[] {
  const pi = period ? series.periods.indexOf(period) : -1;
  const vals =
    pi >= 0
      ? Object.fromEntries(
          Object.entries(series.values).flatMap(([k, arr]) =>
            typeof arr[pi] === "number" ? [[k, arr[pi] as number]] : [],
          ),
        )
      : latestValues(series).values;
  const v = vals[key];
  if (v === undefined) return [];
  const label = series.meta.label;
  const unit = series.meta.unit || undefined;
  const out: Figure[] = [
    fig("value", label, v, series.meta.decimals, {
      ...(unit ? { unit } : {}),
      where: pi >= 0 ? period! : latestValues(series).period,
    }),
  ];
  const r = rankOf(vals, key);
  if (r)
    out.push(
      fig("rank", FL.rank, r.rank, 0, {
        text: `${r.rank} / ${r.of}`,
        where: `of ${r.of} ${series.meta.geoLevel === "canton" ? "cantons" : "municipalities"}`,
      }),
    );
  // change against the previous period when the series has one
  const arr = series.values[key];
  if (arr && arr.length >= 2) {
    const i = pi >= 0 ? pi : arr.length - 1;
    const prev = arr[i - 1];
    const cur = arr[i];
    if (typeof prev === "number" && typeof cur === "number" && prev !== 0)
      out.push(
        fig(
          "change",
          t(
            `Veränderung seit ${series.periods[i - 1]}`,
            `Change since ${series.periods[i - 1]}`,
            `Évolution depuis ${series.periods[i - 1]}`,
            `Variazione dal ${series.periods[i - 1]}`,
          ),
          ((cur - prev) / prev) * 100,
          1,
          {
            unit: "%",
            text: `${cur >= prev ? "+" : "−"}${(Math.abs((cur - prev) / prev) * 100).toFixed(1)} %`,
          },
        ),
      );
  }
  return out;
}

export function votePlaceFigures(vote: VoteResult, key: string): Figure[] {
  const share = /^[A-Z]{2}$/.test(key)
    ? vote.byCanton[key as keyof typeof vote.byCanton]
    : vote.byMunicipality[key];
  if (!share) return [];
  const out: Figure[] = [];
  if (share.yesPct !== null)
    out.push(
      fig("yes", FL.yes, share.yesPct, 1, {
        unit: "%",
        where: vote.meta.title.en ?? vote.meta.title.de,
      }),
    );
  if (share.turnoutPct !== null)
    out.push(fig("turnout", FL.turnout, share.turnoutPct, 1, { unit: "%" }));
  if (share.yesPct !== null && vote.national.yesPct !== null)
    out.push(
      fig("vs-national", FL.vsNational, share.yesPct - vote.national.yesPct, 1, {
        text: `${share.yesPct >= vote.national.yesPct ? "+" : "−"}${Math.abs(share.yesPct - vote.national.yesPct).toFixed(1)} pt`,
        where: `national ${vote.national.yesPct.toFixed(1)} %`,
      }),
    );
  return out;
}
