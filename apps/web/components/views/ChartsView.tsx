"use client";

import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import type { EnergyState, GenerationType } from "@swiss-now/core";
import { ground, layerAccent } from "@swiss-now/motion/tokens";
import { PlotFigure } from "../charts/PlotFigure";
import { StatsCharts } from "./StatsCharts";
import type { GeoRegister, IndicatorSeries } from "@swiss-now/core";
import { formatNumber } from "@/lib/format";
import { useT, type Translate } from "@/lib/i18n/lang";
import { LOCALE } from "@swiss-now/core/i18n";

const typeLabel = (t: Translate, type: GenerationType) => t(`gen.${type}`);
const ORDER: GenerationType[] = [
  "nuclear",
  "runOfRiver",
  "reservoir",
  "pumpedStorage",
  "wind",
  "solar",
  "others",
  "crossBorder",
];
const COLORS: Record<GenerationType, string> = {
  nuclear: ground.ink,
  runOfRiver: layerAccent.hydrology,
  reservoir: "#5B8DB8",
  pumpedStorage: "#9DBBD8",
  wind: layerAccent.wind,
  solar: "#E8B76E",
  others: ground.mist,
  crossBorder: layerAccent.energy,
};

/** The CHARTS mode for ENERGY: the last day's production mix as stacked areas, hour by hour. */
export function EnergyCharts({ energy }: { energy: EnergyState | undefined }) {
  const { t, lang } = useT();
  const rows = useMemo(() => {
    const s = energy?.generationSeries;
    if (!s) return [];
    const out: { t: Date; type: string; mw: number }[] = [];
    s.unixSeconds.forEach((sec, i) => {
      for (const type of ORDER) {
        const v = s.byTypeMW[type]?.[i];
        if (typeof v === "number")
          out.push({
            t: new Date(sec * 1000),
            type: typeLabel(t, type),
            mw: type === "crossBorder" ? Math.max(0, v) : v,
          });
      }
    });
    return out;
  }, [energy, t]);
  const options = useMemo<Plot.PlotOptions>(
    () => ({
      height: 320,
      marginLeft: 48,
      marginRight: 16,
      x: {
        type: "time",
        label: null,
        tickFormat: (d: Date) =>
          new Intl.DateTimeFormat(LOCALE[lang], {
            hour: "2-digit",
            timeZone: "Europe/Zurich",
          }).format(d),
      },
      y: { label: "MW", grid: true, tickFormat: (v: number) => formatNumber(v, 0) },
      color: {
        domain: ORDER.map((x) => typeLabel(t, x)),
        range: ORDER.map((x) => COLORS[x]),
        legend: true,
      },
      marks: [
        Plot.areaY(rows, {
          x: "t",
          y: "mw",
          fill: "type",
          order: ORDER.map((x) => typeLabel(t, x)),
          curve: "step",
        }),
        Plot.ruleY([0], { stroke: ground.ink }),
      ],
    }),
    [rows, t, lang],
  );
  if (!energy) return <p className="charts__empty label">{t("loadingEnergy")}</p>;
  return (
    <div className="charts">
      <header className="charts__header">
        <h2 className="charts__title">{t("productionMix")}</h2>
        <p className="charts__meta label">
          {t("hourlyNote")}
          {energy.generation
            ? ` · ${t("latestHour", { time: new Intl.DateTimeFormat(LOCALE[lang], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }).format(new Date(energy.generation.observedAt)) })}`
            : ""}
        </p>
      </header>
      {rows.length ? (
        <PlotFigure options={options} title={t("productionChartTitle")} />
      ) : (
        <p className="label">{t("noSeries")}</p>
      )}
      {energy.price ? (
        <p className="charts__meta">
          {t("dayAheadNow")}{" "}
          <strong className="tnum">{formatNumber(energy.price.eurPerMWh, 0)} €/MWh</strong>
        </p>
      ) : null}
      {energy.reservoir && energy.reservoir.series.length > 10 ? (
        <ReservoirChart reservoir={energy.reservoir} />
      ) : null}
    </div>
  );
}

function ReservoirChart({ reservoir }: { reservoir: NonNullable<EnergyState["reservoir"]> }) {
  const { t } = useT();
  const rows = useMemo(
    () =>
      reservoir.series.map((r) => ({
        t: new Date(`${r.date}T12:00:00Z`),
        gwh: r.gwh,
        max: r.maxGwh,
      })),
    [reservoir],
  );
  const options = useMemo<Plot.PlotOptions>(
    () => ({
      height: 220,
      marginLeft: 56,
      marginRight: 16,
      x: { type: "time", label: null },
      y: { label: "GWh", grid: true, tickFormat: (v: number) => formatNumber(v, 0) },
      marks: [
        Plot.areaY(rows, {
          x: "t",
          y: "gwh",
          fill: layerAccent.hydrology,
          fillOpacity: 0.12,
          curve: "monotone-x",
        }),
        Plot.lineY(rows, {
          x: "t",
          y: "gwh",
          stroke: layerAccent.hydrology,
          strokeWidth: 1.5,
          curve: "monotone-x",
        }),
        Plot.lineY(rows, { x: "t", y: "max", stroke: ground.mist, strokeDasharray: "3,3" }),
        Plot.dot(rows.slice(-1), { x: "t", y: "gwh", fill: layerAccent.hydrology, r: 4 }),
      ],
    }),
    [rows],
  );
  return (
    <>
      <h3 className="charts__title charts__title--small">{t("energy.reservoirTitle")}</h3>
      <p className="charts__meta label">{t("energy.reservoirNote")}</p>
      <PlotFigure options={options} title={t("energy.reservoirTitle")} />
    </>
  );
}

export interface ChartsViewProps {
  topic: string;
  energy: EnergyState | undefined;
  stats?:
    | {
        series: IndicatorSeries | undefined;
        national?: IndicatorSeries | undefined;
        register: GeoRegister | undefined;
        accent: string;
        period: string | undefined;
      }
    | undefined;
}

export function ChartsView({ topic, energy, stats }: ChartsViewProps) {
  const { t } = useT();
  return (
    <section className="charts-view" aria-label={t("charts")}>
      {topic === "energy" ? (
        <EnergyCharts energy={energy} />
      ) : stats ? (
        <StatsCharts {...stats} />
      ) : (
        <p className="label">{t("noChartsYet")}</p>
      )}
    </section>
  );
}
