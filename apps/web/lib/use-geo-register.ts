"use client";

import { useEffect, useState } from "react";
import { GeoRegister, type GeoRegister as GeoRegisterType } from "@swiss-now/core/state";

let registerPromise: Promise<GeoRegisterType | undefined> | undefined;

/** The municipality register (2 100 municipalities, 26 cantons), fetched once per session. */
export function useGeoRegister(enabled: boolean): GeoRegisterType | undefined {
  const [reg, setReg] = useState<GeoRegisterType | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    registerPromise ??= fetch("/geo/municipalities-2026.json")
      .then((r) => (r.ok ? r.json() : undefined))
      .then((j: unknown) => (j ? GeoRegister.parse(j) : undefined))
      .catch(() => undefined);
    let cancelled = false;
    void registerPromise.then((r) => !cancelled && setReg(r));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return reg;
}
