"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { duration } from "@swiss-now/motion/tokens";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
import type { HydrologyState, WeatherState } from "@swiss-now/core";
import type { ActiveLayer } from "@/lib/layers";
import { formatNumber, formatTime } from "@/lib/format";

/** National summary — the default view already answers "what is it like out there". */
export function SummaryStrip({
  state,
  hydrology,
  active = "now",
  children,
  home,
}: {
  state: WeatherState;
  hydrology?: HydrologyState | undefined;
  active?: ActiveLayer;
  children?: ReactNode;
  home?: ReactNode;
}) {
  const name = (id: string) => state.stations.find((s) => s.id === id)?.name.en ?? id;
  const items: { label: string; value: string; unit: string; where: string }[] = [];
  const water: typeof items = [];
  if (hydrology) {
    const basel = hydrology.observations.find(
      (o) => o.stationId === "bafu:2289" && o.parameter === "discharge",
    );
    if (basel)
      water.push({
        label: "Rhine at Basel",
        value: formatNumber(basel.value, 0),
        unit: "m³/s",
        where: "FOEN, Rheinhalle",
      });
    const elevated = Object.values(hydrology.dangerLevels).filter((d) => d >= 2).length;
    water.push({
      label: "Flood danger",
      value: String(elevated),
      unit: elevated === 1 ? "station ≥ level 2" : "stations ≥ level 2",
      where: `${Object.keys(hydrology.dangerLevels).length} classified stations`,
    });
    const temps = hydrology.observations.filter((o) => o.parameter === "waterTemperature");
    const warmest = temps.reduce<(typeof temps)[number] | undefined>(
      (b, o) => (!b || o.value > b.value ? o : b),
      undefined,
    );
    if (warmest) {
      const st = hydrology.stations.find((s) => s.id === warmest.stationId);
      water.push({
        label: "Warmest river",
        value: formatNumber(warmest.value),
        unit: "°C",
        where: `${st?.waterBody ?? ""} ${st?.name.de ?? ""}`.trim(),
      });
    }
  }
  if (state.extremes.warmest)
    items.push({
      label: "Warmest",
      value: formatNumber(state.extremes.warmest.value),
      unit: "°C",
      where: name(state.extremes.warmest.stationId),
    });
  if (state.extremes.coldest)
    items.push({
      label: "Coldest",
      value: formatNumber(state.extremes.coldest.value),
      unit: "°C",
      where: name(state.extremes.coldest.stationId),
    });
  if (state.extremes.windiestGust)
    items.push({
      label: "Strongest gust",
      value: formatNumber(state.extremes.windiestGust.value, 0),
      unit: "km/h",
      where: name(state.extremes.windiestGust.stationId),
    });
  if (state.rainingShare !== undefined)
    items.push({
      label: "Stations reporting rain",
      value: formatNumber(state.rainingShare * 100, 0),
      unit: "%",
      where: `${state.stations.length} stations`,
    });

  const shown =
    active === "water"
      ? water
      : active === "weather"
        ? items
        : [...items.slice(0, 3), ...water.slice(0, 1)];
  return (
    <>
      <motion.header
        className="hud hud--top"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.layerSwitch / 1000, ease: EASE }}
      >
        <h1>Swiss Now</h1>
        {home}
        <span className="label tnum">
          Switzerland · {formatTime(state.observedAt)} ·{" "}
          <span className="freshness" data-state={state.freshness}>
            {state.freshness}
          </span>
        </span>
      </motion.header>
      <motion.section
        className="hud hud--bottom"
        aria-label="Switzerland right now"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.layerSwitch / 1000, ease: EASE, delay: 0.08 }}
      >
        {children}
        <div className="strip">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((m) => (
              <motion.div
                className="metric metric--hud"
                key={m.label}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: duration.panel / 1000, ease: EASE }}
              >
                <div className="label">{m.label}</div>
                <div className="value tnum">
                  {m.value}
                  <span className="unit">{m.unit}</span>
                </div>
                <div className="where">{m.where}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="colophon colophon--hud">
          <span>Source: MeteoSwiss</span>
          {hydrology ? <span>Source: FOEN</span> : null}
          <span>© swisstopo</span>
          <Link href="/status">Status</Link>
        </div>
      </motion.section>
    </>
  );
}
