"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { HydrologyState, WeatherState } from "@swiss-now/core";
import { useLayerState } from "@/lib/use-layer-state";
import { LayerRail } from "../hud/LayerRail";
import type { ActiveLayer } from "@/lib/layers";
import { useHomePlace } from "@/lib/use-home-place";
import type { Place } from "@/lib/places";
import { HomePlace } from "../hud/HomePlace";
import { LiveMap } from "./LiveMap";
import { WindParticles } from "./WindParticles";
import { RadarScrubber } from "../hud/RadarScrubber";
import { useRadarTimeline } from "@/lib/use-radar-timeline";
import { SummaryStrip } from "../hud/SummaryStrip";
import { FpsMeter } from "../hud/FpsMeter";

export function MapPage({
  initial,
  initialHydrology,
}: {
  initial: WeatherState;
  initialHydrology?: HydrologyState | undefined;
}) {
  const weather = useLayerState("/api/state/weather", initial, 300_000);
  const hydrology = useLayerState("/api/state/hydrology", initialHydrology, 600_000);
  const [active, setActive] = useState<ActiveLayer>("now");
  const { home, setHome } = useHomePlace();
  const [focus, setFocus] = useState<
    { lonLat: [number, number]; zoom: number; key: string } | null | undefined
  >(undefined);
  const focusPlace = (p: Place) =>
    setFocus({ lonLat: p.lonLat, zoom: 9.2, key: `${p.id}:${Date.now()}` });
  const params = useSearchParams();
  const showFps = params.get("fps") === "1";
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const radar = useRadarTimeline(weather);
  return (
    <>
      <LiveMap
        weather={weather}
        hydrology={hydrology}
        active={active}
        radarFrame={radar.frame}
        onMapReady={setMap}
      />
      {active !== "water" ? <WindParticles map={map} weather={weather} /> : null}
      <LayerRail active={active} onChange={setActive} />
      <SummaryStrip
        state={weather}
        hydrology={hydrology}
        active={active}
        home={
          <HomePlace
            home={home}
            onChange={(p) => {
              setHome(p);
              if (!p) setFocus(null);
            }}
            onFocus={focusPlace}
            weather={weather}
            hydrology={hydrology}
          />
        }
      >
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
