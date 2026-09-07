"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { WeatherState } from "@swiss-now/core";
import { useWeatherState } from "@/lib/use-weather-state";
import { LiveMap } from "./LiveMap";
import { WindParticles } from "./WindParticles";
import { RadarScrubber } from "../hud/RadarScrubber";
import { useRadarTimeline } from "@/lib/use-radar-timeline";
import { SummaryStrip } from "../hud/SummaryStrip";
import { FpsMeter } from "../hud/FpsMeter";

export function MapPage({ initial }: { initial: WeatherState }) {
  const weather = useWeatherState(initial);
  const params = useSearchParams();
  const showFps = params.get("fps") === "1";
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const radar = useRadarTimeline(weather);
  return (
    <>
      <LiveMap weather={weather} radarFrame={radar.frame} onMapReady={setMap} />
      <WindParticles map={map} weather={weather} />
      <SummaryStrip state={weather}>
        <RadarScrubber
          frames={radar.frames}
          index={radar.index}
          playing={radar.playing}
          onChange={radar.scrubTo}
          onTogglePlay={radar.togglePlay}
        />
      </SummaryStrip>
      {showFps ? <FpsMeter /> : null}
    </>
  );
}
