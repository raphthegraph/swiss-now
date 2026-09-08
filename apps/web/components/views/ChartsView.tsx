"use client";

import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import type { EnergyState, GenerationType } from "@swiss-now/core";
import { ground, layerAccent } from "@swiss-now/motion/tokens";
import { PlotFigure } from "../charts/PlotFigure";
import { StatsCharts } from "./StatsCharts";
import type { GeoRegister, IndicatorSeries } from "@swiss-now/core";
import { formatNumber } from "@/lib/format";

const TYPE_LABEL: Record<GenerationType, string> = {
  nuclear: "Nuclear",
  runOfRiver: "Run-of-river hydro",
  reservoir: "Reservoir hydro",
  pumpedStorage: "Pumped storage",
  wind: "Wind",
  solar: "Solar",
  others: "Others",
  crossBorder: "Net import",
};
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
            type: TYPE_LABEL[type],
            mw: type === "crossBorder" ? Math.max(0, v) : v,
          });
      }
    });
    return out;
  }, [energy]);
  const options = useMemo<Plot.PlotOptions>(
    () => ({
      height: 320,
      marginLeft: 48,
      marginRight: 16,
      x: {
        type: "time",
        label: null,
        tickFormat: (d: Date) =>
          new Intl.DateTimeFormat("en-GB", { hour: "2-digit", timeZone: "Europe/Zurich" }).format(
            d,
          ),
      },
      y: { label: "MW", grid: true, tickFormat: (v: number) => formatNumber(v, 0) },
      color: {
        domain: ORDER.map((t) => TYPE_LABEL[t]),
        range: ORDER.map((t) => COLORS[t]),
        legend: true,
      },
      marks: [
        Plot.areaY(rows, {
          x: "t",
          y: "mw",
          fill: "type",
          order: ORDER.map((t) => TYPE_LABEL[t]),
          curve: "step",
        }),
        Plot.ruleY([0], { stroke: ground.ink }),
      ],
    }),
    [rows],
  );
  if (!energy) return <p className="charts__empty label">Loading energy data…</p>;
  return (
    <div className="charts">
      <header className="charts__header">
        <h2 className="charts__title">Production mix, last 24 hours</h2>
        <p className="charts__meta label">
          Hourly, Swiss bidding zone · Energy-Charts.info (Fraunhofer ISE), CC BY 4.0
          {energy.generation
            ? ` · latest hour ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }).format(new Date(energy.generation.observedAt))}`
            : ""}
        </p>
      </header>
      {rows.length ? (
        <PlotFigure options={options} title="Swiss electricity production by type, last 24 hours" />
      ) : (
        <p className="label">No hourly series available.</p>
      )}
      {energy.price ? (
        <p className="charts__meta">
          Day-ahead price this hour:{" "}
          <strong className="tnum">{formatNumber(energy.price.eurPerMWh, 0)} €/MWh</strong>
        </p>
      ) : null}
    </div>
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
  return (
    <section className="charts-view" aria-label="Charts">
      {topic === "energy" ? (
        <EnergyCharts energy={energy} />
      ) : stats ? (
        <StatsCharts {...stats} />
      ) : (
        <p className="label">No charts for this topic yet.</p>
      )}
    </section>
  );
}
