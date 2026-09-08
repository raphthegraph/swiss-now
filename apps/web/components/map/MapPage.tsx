"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { HydrologyState, RailState, WeatherState } from "@swiss-now/core";
import { TrainLayer, type TrainHover } from "./TrainLayer";
import { TrainHoverCard } from "./TrainHoverCard";
import { RailLegend } from "../hud/RailLegend";
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
  initialRail,
}: {
  initial: WeatherState;
  initialHydrology?: HydrologyState | undefined;
  initialRail?: RailState | undefined;
}) {
  const weather = useLayerState("/api/state/weather", initial, 300_000);
  const hydrology = useLayerState("/api/state/hydrology", initialHydrology, 600_000);
  const rail = useLayerState("/api/state/rail", initialRail, 60_000);
  const [trainHover, setTrainHover] = useState<TrainHover | null>(null);
  const [railProgress, setRailProgress] = useState({ loaded: 0, needed: 0 });
  const stopNames = useStopNames(rail);
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
  // the radar timeline is a WEATHER instrument; elsewhere the map shows the latest frame only
  const radarReset = radar.reset;
  useEffect(() => {
    if (active !== "weather") radarReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the view changes
  }, [active]);
  return (
    <>
      <LiveMap
        weather={weather}
        hydrology={hydrology}
        disruptions={rail?.disruptions}
        active={active}
        radarFrame={radar.frame}
        onMapReady={setMap}
      />
      {active === "now" || active === "weather" ? (
        <WindParticles map={map} weather={weather} />
      ) : null}
      {active === "now" || active === "rail" ? (
        <TrainLayer
          map={map}
          rail={rail}
          mode={active === "rail" ? "full" : "quiet"}
          onHover={setTrainHover}
          onProgress={(loaded, needed) => setRailProgress({ loaded, needed })}
        />
      ) : null}
      {active === "rail" && trainHover && rail ? (
        <div className="hover-anchor">
          <TrainHoverCard hover={trainHover} freshness={rail.freshness} stopName={stopNames} />
        </div>
      ) : null}
      <LayerRail active={active} onChange={setActive} />
      <SummaryStrip
        state={weather}
        hydrology={hydrology}
        rail={rail}
        active={active}
        legend={
          active === "rail" ? (
            <RailLegend loaded={railProgress.loaded} needed={railProgress.needed} />
          ) : null
        }
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
        {active === "weather" ? (
          <RadarScrubber
            frames={radar.frames}
            index={radar.index}
            playing={radar.playing}
            onChange={radar.scrubTo}
            onTogglePlay={radar.togglePlay}
          />
        ) : null}
      </SummaryStrip>
      {showFps ? <FpsMeter /> : null}
    </>
  );
}

/** Stop names for hover cards, from the (cached, immutable per build) stops file. */
function useStopNames(rail: RailState | undefined): (id: string) => string {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!rail) return;
    let cancelled = false;
    fetch("/rail/stops.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((stops: Record<string, [number, number, string]>) => {
        if (cancelled) return;
        const out: Record<string, string> = {};
        for (const [id, v] of Object.entries(stops)) out[id] = v[2];
        setNames(out);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rail?.gtfsBuild]);
  return (id: string) => names[id] ?? id;
}
