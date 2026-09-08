"use client";

import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import type { GeoRegister, IndicatorSeries } from "@swiss-now/core";
import { latestValues } from "@swiss-now/core/state";
import { ground } from "@swiss-now/motion/tokens";
import { PlotFigure } from "../charts/PlotFigure";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

/** CHARTS for a statistics topic: a top-twelve ranking of the map's indicator and, when the series is long, its national course. */
export function StatsCharts({
  series,
  national,
  register,
  accent,
  period,
}: {
  series: IndicatorSeries | undefined;
  national?: IndicatorSeries | undefined;
  register: GeoRegister | undefined;
  accent: string;
  period: string | undefined;
}) {
  const { t, l } = useT();
  const ranking = useMemo(() => {
    if (!series) return [];
    const pi = period ? series.periods.indexOf(period) : -1;
    const vals =
      pi >= 0
        ? Object.fromEntries(Object.entries(series.values).map(([k, arr]) => [k, arr[pi]]))
        : latestValues(series).values;
    const name = (key: string) => {
      if (series.meta.geoLevel === "municipality")
        return register?.municipalities.find((m) => String(m.bfs) === key)?.name ?? key;
      if (series.meta.geoLevel === "canton") return register?.cantons[key]?.name ?? key;
      return key;
    };
    return Object.entries(vals)
      .filter(
        ([k, v]) =>
          k !== "CH" &&
          typeof v === "number" &&
          /^[A-Z]{2}$/.test(k) === (series.meta.geoLevel === "canton"),
      )
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 12)
      .map(([k, v]) => ({ name: name(k), value: v as number }));
  }, [series, register, period]);
  const rankingOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 24 * ranking.length + 40,
      marginLeft: 180,
      marginRight: 60,
      x: {
        label: series?.meta.unit ? `${series.meta.unit}` : null,
        grid: true,
        tickFormat: (v: number) => formatNumber(v, 0),
      },
      y: { label: null, domain: ranking.map((r) => r.name) },
      marks: [
        Plot.barX(ranking, { x: "value", y: "name", fill: accent }),
        Plot.text(ranking, {
          x: "value",
          y: "name",
          text: (d: { value: number }) => formatNumber(d.value, series?.meta.decimals ?? 0),
          dx: 6,
          textAnchor: "start",
          fill: ground.ink,
        }),
      ],
    }),
    [ranking, accent, series],
  );
  const course = useMemo(() => {
    const s = national ?? series;
    if (!s) return [];
    const arr = s.values["CH"];
    if (!arr) return [];
    return s.periods
      .map((p, i) => ({ p, v: arr[i] }))
      .filter((d): d is { p: string; v: number } => typeof d.v === "number");
  }, [series, national]);
  const courseMeta = national ?? series;
  const courseOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 220,
      marginLeft: 56,
      x: { label: null, tickFormat: (d: string) => d },
      y: {
        label: courseMeta?.meta.unit || null,
        grid: true,
        nice: true,
        tickFormat: (v: number) => formatNumber(v, 0),
      },
      marks: [
        Plot.lineY(course, { x: "p", y: "v", stroke: ground.ink, strokeWidth: 1.5 }),
        Plot.dot(course.slice(-1), { x: "p", y: "v", fill: accent, r: 4 }),
      ],
    }),
    [course, accent, courseMeta],
  );
  if (!series) return <p className="charts__empty label">{t("loadingStats")}</p>;
  const label = l(series.meta.label);
  return (
    <div className="charts">
      <header className="charts__header">
        <h2 className="charts__title">{t("topTwelve", { label })}</h2>
        <p className="charts__meta label">
          {period ?? latestValues(series).period} · {series.meta.attribution}
        </p>
      </header>
      {ranking.length ? (
        <PlotFigure options={rankingOptions} title={t("ranking", { label })} />
      ) : null}
      {course.length > 3 ? (
        <>
          <h3 className="charts__title charts__title--small">
            {t("labelSwitzerland", { label: l(courseMeta?.meta.label) })}
          </h3>
          <PlotFigure
            options={courseOptions}
            title={t("nationalCourse", { label: l(courseMeta?.meta.label) })}
          />
        </>
      ) : null}
    </div>
  );
}
