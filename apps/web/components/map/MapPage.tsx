"use client";

import { useSearchParams } from "next/navigation";
import type { WeatherState } from "@swiss-now/core";
import { useWeatherState } from "@/lib/use-weather-state";
import { LiveMap } from "./LiveMap";
import { SummaryStrip } from "../hud/SummaryStrip";
import { FpsMeter } from "../hud/FpsMeter";

export function MapPage({ initial }: { initial: WeatherState }) {
  const weather = useWeatherState(initial);
  const params = useSearchParams();
  const showFps = params.get("fps") === "1";
  return (
    <>
      <LiveMap weather={weather} />
      <SummaryStrip state={weather} />
      {showFps ? <FpsMeter /> : null}
    </>
  );
}
