"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";
import type {
  HydrologyState,
  PoliticsState,
  RailState,
  SeismicState,
  VoteResult,
  WeatherState,
} from "@swiss-now/core";
import { VoteResult as VoteResultSchema } from "@swiss-now/core/state";
import { figuresFor, presenceFor, type TopicId } from "@swiss-now/core/topics";
import { choroplethContribution } from "@/lib/map/contributions/choropleth";
import { dataUrl } from "@/lib/data-url";
import { formatDate } from "@/lib/format";
import { RampLegend } from "../hud/RampLegend";
import { VoteScrubber } from "../hud/VoteScrubber";
import { QuakeLayer, type QuakeHover } from "./QuakeLayer";
import { QuakeHoverCard } from "./QuakeHoverCard";
import { TrainLayer, type TrainHover } from "./TrainLayer";
import { TrainHoverCard } from "./TrainHoverCard";
import { RailLegend } from "../hud/RailLegend";
import { useLayerState } from "@/lib/use-layer-state";
import { useViewState } from "@/lib/use-view-state";
import { useHomePlace } from "@/lib/use-home-place";
import type { Place } from "@/lib/places";
import { HomePlace } from "../hud/HomePlace";
import { LiveMap, type LayerPresence } from "./LiveMap";
import { WindParticles } from "./WindParticles";
import { RadarScrubber } from "../hud/RadarScrubber";
import { useRadarTimeline } from "@/lib/use-radar-timeline";
import { useSnapshotPing } from "@/lib/use-snapshot-ping";
import { TopicRail } from "../hud/TopicRail";
import { ModeSwitcher } from "../hud/ModeSwitcher";
import { Masthead } from "../hud/Masthead";
import { FigureStrip } from "../hud/FigureStrip";
import { FpsMeter } from "../hud/FpsMeter";

/** Which layers each topic renders (from the registry); used for presence and for polling. */
function presenceOf(topic: TopicId): LayerPresence {
  return {
    weather: presenceFor(topic, "weather"),
    hydrology: presenceFor(topic, "hydrology"),
    rail: presenceFor(topic, "rail"),
    seismic: presenceFor(topic, "seismic"),
    politics: presenceFor(topic, "politics"),
  };
}

/** The vote to show: the timeline selection when it is in the index, else the latest Sunday's first. */
function useVoteResult(
  id: string | undefined,
  politics: PoliticsState | undefined,
): VoteResult | undefined {
  const [cache] = useState(() => new Map<string, VoteResult>());
  const [result, setResult] = useState<VoteResult | undefined>(undefined);
  useEffect(() => {
    if (!id) return setResult(undefined);
    const known = politics?.latest.find((v) => v.meta.id === id) ?? cache.get(id);
    if (known) return setResult(known);
    let cancelled = false;
    fetch(dataUrl(`politics/votes/${id}.json`))
      .then((r) => (r.ok ? r.json() : undefined))
      .then((j: unknown) => {
        if (cancelled || !j) return;
        const parsed = VoteResultSchema.safeParse(j);
        if (parsed.success) {
          cache.set(id, parsed.data);
          setResult(parsed.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, politics, cache]);
  return result;
}

export function MapPage({
  initial,
  initialHydrology,
  initialRail,
  initialSeismic,
}: {
  initial: WeatherState;
  initialHydrology?: HydrologyState | undefined;
  initialRail?: RailState | undefined;
  initialSeismic?: SeismicState | undefined;
}) {
  const { view, setTopic, setMode, setTime } = useViewState();
  const { topic, mode } = view;
  const presence = useMemo(() => presenceOf(topic), [topic]);
  // poll only what is on screen (the masthead clock always needs weather)
  const weather = useLayerState("/api/state/weather", initial, 300_000);
  const hydrology = useLayerState(
    "/api/state/hydrology",
    initialHydrology,
    600_000,
    presence.hydrology !== "off",
  );
  const rail = useLayerState("/api/state/rail", initialRail, 60_000, presence.rail !== "off");
  const seismic = useLayerState(
    "/api/state/seismic",
    initialSeismic,
    120_000,
    presence.seismic !== "off",
  );
  const politics = useLayerState<PoliticsState | undefined>(
    "/api/state/politics",
    undefined,
    3_600_000,
    presence.politics !== "off",
  );
  const voteId =
    view.t && politics?.index.some((v) => v.id === view.t) ? view.t : politics?.latest[0]?.meta.id;
  const vote = useVoteResult(voteId, politics);
  const [choropleth] = useState(() =>
    choroplethContribution({
      id: "politics",
      layer: "politics",
      topoUrl: "/geo/ch-2026.topo.json",
      scale: "yesShare",
      hoverExtras: { choropleth: { label: "yes", unit: "%", source: "Source: BFS" } },
    }),
  );
  const choroState = useMemo(
    () =>
      vote
        ? Object.fromEntries(
            Object.entries(vote.byMunicipality).map(([bfs, sh]) => [
              bfs,
              { value: sh.yesPct, turnout: sh.turnoutPct },
            ]),
          )
        : undefined,
    [vote],
  );
  const contributions = useMemo(
    () => [{ contribution: choropleth, state: choroState }],
    [choropleth, choroState],
  );
  const [quakeHover, setQuakeHover] = useState<QuakeHover | null>(null);
  // HAZARDS (quakes only for now) joins the rail when a magnitude ≥ 2.0 event happened in the window
  const quakesNotable = (seismic?.events ?? []).some((e) => (e.magnitude ?? 0) >= 2);
  const [trainHover, setTrainHover] = useState<TrainHover | null>(null);
  const [railProgress, setRailProgress] = useState({ loaded: 0, needed: 0 });
  const stopNames = useStopNames(rail);
  const { home, setHome } = useHomePlace();
  const [focus, setFocus] = useState<
    { lonLat: [number, number]; zoom: number; key: string } | null | undefined
  >(undefined);
  const focusPlace = (p: Place) =>
    setFocus({ lonLat: p.lonLat, zoom: 9.2, key: `${p.id}:${Date.now()}` });
  const params = useSearchParams();
  const showFps = params.get("fps") === "1";
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // visitor-driven persistence: keeps the day's snapshots (the story's input) written while someone watches
  useSnapshotPing();
  const radar = useRadarTimeline(weather);
  // the radar timeline is the WEATHER topic's TIMELINE instrument; elsewhere the map shows the latest frame
  const radarOn = topic === "weather" && mode === "timeline";
  const radarReset = radar.reset;
  useEffect(() => {
    if (!radarOn) radarReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the view changes
  }, [radarOn]);
  const figures = useMemo(
    () => figuresFor(topic, { weather, hydrology, rail, seismic, politics, vote }),
    [topic, weather, hydrology, rail, seismic, politics, vote],
  );
  const voteStatus =
    topic === "politics" && vote ? (
      <span className="label tnum">
        Vote of {formatDate(vote.meta.date)} · {vote.status} · Source: BFS
      </span>
    ) : undefined;
  return (
    <>
      <LiveMap
        weather={weather}
        hydrology={hydrology}
        disruptions={rail?.disruptions}
        presence={presence}
        muted={topic === "rail" || topic === "hazards"}
        focus={focus}
        radarFrame={radar.frame}
        contributions={contributions}
        onMapReady={(m) => {
          setMap(m);
          // QA hook: the software-WebGL harness reads sources and feature state through it
          (window as unknown as { __swissNowMap?: MapLibreMap }).__swissNowMap = m;
        }}
      />
      {presence.weather !== "off" ? <WindParticles map={map} weather={weather} /> : null}
      {presence.rail !== "off" ? (
        <TrainLayer
          map={map}
          rail={rail}
          mode={presence.rail === "full" ? "full" : "quiet"}
          onHover={setTrainHover}
          onProgress={(loaded, needed) => setRailProgress({ loaded, needed })}
        />
      ) : null}
      {topic === "rail" && trainHover && rail ? (
        <div className="hover-anchor">
          <TrainHoverCard hover={trainHover} freshness={rail.freshness} stopName={stopNames} />
        </div>
      ) : null}
      {presence.seismic !== "off" ? (
        <QuakeLayer
          map={map}
          seismic={seismic}
          mode={presence.seismic === "full" ? "full" : "quiet"}
          onHover={setQuakeHover}
        />
      ) : null}
      {topic === "hazards" && quakeHover ? (
        <div className="hover-anchor">
          <QuakeHoverCard hover={quakeHover} />
        </div>
      ) : null}
      <TopicRail view={view} onSelect={setTopic} hidden={quakesNotable ? [] : ["hazards"]} />
      <ModeSwitcher view={view} onChange={setMode} />
      <Masthead
        status={voteStatus}
        clock={{ observedAt: weather.observedAt, freshness: weather.freshness }}
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
      />
      <FigureStrip
        topic={topic}
        figures={figures}
        legend={
          topic === "rail" ? (
            <RailLegend loaded={railProgress.loaded} needed={railProgress.needed} />
          ) : topic === "politics" ? (
            <RampLegend scale="yesShare" label="Yes share" unit=" %" />
          ) : null
        }
      >
        {topic === "politics" && mode === "timeline" && politics && voteId ? (
          <VoteScrubber votes={politics.index} selectedId={voteId} onChange={setTime} />
        ) : null}
        {radarOn ? (
          <RadarScrubber
            frames={radar.frames}
            index={radar.index}
            playing={radar.playing}
            onChange={radar.scrubTo}
            onTogglePlay={radar.togglePlay}
          />
        ) : null}
      </FigureStrip>
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
