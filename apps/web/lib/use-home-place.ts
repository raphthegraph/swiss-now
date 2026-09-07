"use client";

import { useCallback, useEffect, useState } from "react";
import { PLACES, type Place } from "./places";

const KEY = "swiss-now:home";

/**
 * The one personalisation lever (docs/PRODUCT_VISION.md §2): a home place stored in the browser.
 * No account, no server round trip; `undefined` until read on the client to avoid hydration drift.
 */
export function useHomePlace() {
  const [home, setHomeState] = useState<Place | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      const found = raw ? PLACES.find((p) => p.id === raw) : undefined;
      setHomeState(found ?? null);
    } catch {
      setHomeState(null);
    }
  }, []);

  const setHome = useCallback((place: Place | null) => {
    setHomeState(place);
    try {
      if (place) window.localStorage.setItem(KEY, place.id);
      else window.localStorage.removeItem(KEY);
    } catch {
      // storage unavailable (private mode); the choice still applies for this session
    }
  }, []);

  return { home, setHome };
}
