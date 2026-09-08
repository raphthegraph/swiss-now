"use client";

import { useEffect, useState } from "react";

/**
 * Visibility-aware poller for a /api/state/* route. Starts from the server-rendered state so the
 * map has data on first paint; refetches at the source cadence (with jitter) only while the tab is
 * visible. Errors keep the last good state. `enabled=false` pauses polling (topics not on screen).
 */
export function useLayerState<T>(url: string, initial: T, intervalMs: number, enabled = true): T {
  const [state, setState] = useState(initial);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastFetch = Date.now();

    const refetch = async () => {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (res.status === 200) {
          const next = (await res.json()) as T;
          if (!cancelled) setState(next);
        }
      } catch {
        // keep the last good state
      } finally {
        lastFetch = Date.now();
      }
    };
    const schedule = () => {
      timer = setTimeout(
        async () => {
          if (document.visibilityState === "visible") await refetch();
          schedule();
        },
        intervalMs + Math.random() * intervalMs * 0.15,
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > intervalMs)
        void refetch();
    };
    // no server-rendered seed (a topic loaded on demand): fetch now, then poll
    if (state === undefined) void refetch();
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `state` only decides the initial fetch
  }, [url, intervalMs, enabled]);

  return state;
}
