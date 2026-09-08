"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HydrologyState, WeatherState } from "@swiss-now/core";
import { cssEasing, duration } from "@swiss-now/motion/tokens";
import { nearestPlace, PLACES, type Place } from "@/lib/places";
import { localSummary } from "@/lib/local-summary";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

const ease = cssEasing.house
  .replace("cubic-bezier(", "")
  .replace(")", "")
  .split(",")
  .map(Number) as [number, number, number, number];

export interface HomePlaceProps {
  home: Place | null | undefined;
  onChange: (place: Place | null) => void;
  onFocus: (place: Place) => void;
  weather: WeatherState;
  hydrology?: HydrologyState | undefined;
}

/** Masthead control: your Switzerland in one line, and the picker to choose it. */
export function HomePlace({ home, onChange, onFocus, weather, hydrology }: HomePlaceProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const locate = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const place = nearestPlace([pos.coords.longitude, pos.coords.latitude]);
        onChange(place);
        onFocus(place);
        setLocating(false);
        setOpen(false);
      },
      () => setLocating(false),
      { maximumAge: 600_000, timeout: 8000 },
    );
  };

  const summary = home ? localSummary(home.lonLat, weather, hydrology) : undefined;

  return (
    <div className="home" ref={rootRef}>
      <button
        type="button"
        className="home__button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {home === undefined ? (
          <span className="label">&nbsp;</span>
        ) : home ? (
          <>
            <span className="home__name">{home.name}</span>
            {summary ? (
              <span className="home__now tnum">
                {summary.temperature !== undefined ? ` ${formatNumber(summary.temperature)}°` : ""}
                {summary.rain10min !== undefined
                  ? summary.rain10min > 0
                    ? ` · ${t("raining", { mm: formatNumber(summary.rain10min) })}`
                    : ` · ${t("dry")}`
                  : ""}
                {summary.gustKmh !== undefined && summary.gustKmh >= 20
                  ? ` · ${t("gusts", { v: formatNumber(summary.gustKmh, 0) })}`
                  : ""}
                {summary.river?.discharge !== undefined
                  ? ` · ${summary.river.waterBody ?? summary.river.name} ${formatNumber(summary.river.discharge, 0)} m³/s`
                  : ""}
              </span>
            ) : null}
          </>
        ) : (
          <span className="label">{t("setHome")}</span>
        )}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="home__popover"
            role="listbox"
            aria-label={t("homePlace")}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: duration.panel / 1000, ease }}
          >
            <button type="button" className="home__action" onClick={locate} disabled={locating}>
              {locating ? t("locating") : t("useLocation")}
            </button>
            <ul>
              {PLACES.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={home?.id === p.id}
                    className="home__option"
                    onClick={() => {
                      onChange(p);
                      onFocus(p);
                      setOpen(false);
                    }}
                  >
                    {p.name} <span className="label">{p.cantonCode}</span>
                  </button>
                </li>
              ))}
            </ul>
            {home ? (
              <button
                type="button"
                className="home__action"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {t("clearHome")}
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {summary && home ? (
        <span className="home__meta label">
          {t("nearestStation", { name: summary.stationName, km: summary.distanceKm })}
        </span>
      ) : null}
    </div>
  );
}
