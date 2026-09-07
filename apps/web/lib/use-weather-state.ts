"use client";

import { useEffect, useState } from "react";
import type { WeatherState } from "@swiss-now/core";

/**
 * Visibility-aware poller for /api/state/weather. Starts from the server-rendered state so the map
 * has data on first paint; refetches at the source cadence only while the tab is visible.
 * (TanStack Query replaces this once several layers exist.)
 */
export function useWeatherState(initial: WeatherState, intervalMs = 300_000): WeatherState {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastFetch = Date.now();

    const refetch = async () => {
      try {
        const res = await fetch("/api/state/weather", { headers: { Accept: "application/json" } });
        if (res.status === 200) {
          const next = (await res.json()) as WeatherState;
          if (!cancelled) setState(next);
        }
      } catch {
        // keep the last good state; freshness ageing is handled server-side on the next successful poll
      } finally {
        lastFetch = Date.now();
      }
    };

    const schedule = () => {
      const jitter = Math.random() * intervalMs * 0.15;
      timer = setTimeout(async () => {
        if (document.visibilityState === "visible") await refetch();
        schedule();
      }, intervalMs + jitter);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > intervalMs)
        void refetch();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return state;
}
