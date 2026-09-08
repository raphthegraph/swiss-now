"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";
import type {
  GeoRegister as GeoRegisterType,
  AirState,
  EnergyState,
  EventsState,
  HazardsState,
  HydrologyState,
  PoliticsState,
  RailState,
  SeismicState,
  VoteResult,
  WeatherState,
} from "@swiss-now/core";
import { VoteResult as VoteResultSchema } from "@swiss-now/core/state";
import { figuresFor, figuresForSnapshot, presenceFor, type TopicId } from "@swiss-now/core/topics";
import { useSnapshotTimeline } from "@/lib/use-snapshot-timeline";
import { SnapshotScrubber } from "../hud/SnapshotScrubber";
import { formatAgo, formatTime } from "@/lib/format";
import { indicatorPlaceFigures, votePlaceFigures, type Figure } from "@swiss-now/core/topics";
import { CompareView } from "../views/CompareView";
import type { PlacePick } from "../hud/PlaceSearch";
import { localSummary } from "@/lib/local-summary";
import { Mode } from "@swiss-now/core/topics";
import { choroplethContribution } from "@/lib/map/contributions/choropleth";
import { airContribution } from "@/lib/map/contributions/air";
import { useIndicator, useIndicatorCatalog } from "@/lib/use-indicator";
import { quantileStops, sequentialRamp } from "@/lib/map/quantile-stops";
import { GeoRegister, latestValues } from "@swiss-now/core/state";
import { layerAccent } from "@swiss-now/motion/tokens";
import { DynamicRampLegend } from "../hud/DynamicRampLegend";
import { PeriodScrubber } from "../hud/PeriodScrubber";
import { TOPICS } from "@swiss-now/core/topics";
import { hazardsContribution } from "@/lib/map/contributions/hazards";
import { dataUrl } from "@/lib/data-url";
import { formatDate } from "@/lib/format";
import { RampLegend } from "../hud/RampLegend";
import { VoteScrubber } from "../hud/VoteScrubber";
import { FlowLayer } from "./FlowLayer";
import { EventMarkers } from "./EventMarkers";
import { ChartsView } from "../views/ChartsView";
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
    energy: presenceFor(topic, "energy"),
    events: presenceFor(topic, "events"),
    air: presenceFor(topic, "air"),
    hazards: presenceFor(topic, "hazards"),
    stats: presenceFor(topic, "stats"),
  };
}

const STATS_TOPICS = new Set<TopicId>(["population", "housing", "economy", "tourism"]);
const TOPIC_ORDER_BUILT = (Object.keys(TOPICS) as TopicId[]).filter((t) => TOPICS[t].built);
/** the indicator each statistics topic puts on the map */
const MAP_INDICATOR: Partial<Record<TopicId, string>> = {
  population: "population",
  housing: "vacancy-rate",
  economy: "jobs-fte",
  tourism: "overnight-stays",
};
const accentOf = (t: TopicId) =>
  layerAccent[TOPICS[t].accent as keyof typeof layerAccent] ?? layerAccent.population;

let registerPromise: Promise<GeoRegisterType | undefined> | undefined;
/** The municipality register (names) for figures and charts; fetched once when a statistics topic opens. */
function useGeoRegister(enabled: boolean): GeoRegisterType | undefined {
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
  const { view, setTopic, setMode, setTime, setPlace } = useViewState();
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
  const energy = useLayerState<EnergyState | undefined>(
    "/api/state/energy",
    undefined,
    60_000,
    presence.energy !== "off",
  );
  const events = useLayerState<EventsState | undefined>(
    "/api/state/events",
    undefined,
    300_000,
    presence.events !== "off",
  );
  const air = useLayerState<AirState | undefined>(
    "/api/state/air",
    undefined,
    300_000,
    presence.air !== "off",
  );
  const hazards = useLayerState<HazardsState | undefined>(
    "/api/state/hazards",
    undefined,
    600_000,
    presence.hazards !== "off",
  );
  // TIMELINE over the 10-minute snapshots (weather keeps its radar frames; statistics their periods)
  const snapshotMode =
    mode === "timeline" &&
    !["weather", "politics", "population", "housing", "economy", "tourism"].includes(topic);
  const tl = useSnapshotTimeline(snapshotMode, snapshotMode ? view.t : undefined);
  const past = snapshotMode && tl.index !== null ? tl.snapshot : undefined;
  const viewWeather = past?.weather ?? weather;
  const viewHydrology = past?.hydrology ?? hydrology;
  const viewSeismic = past?.seismic ?? seismic;
  const viewDisruptions = past ? past.rail?.disruptions : rail?.disruptions;
  // COMPARE: two places from the URL (`place=a,b`), the same figures for each
  const compareMode = mode === "compare";
  const compareRegister = useGeoRegister(compareMode);
  const placeKeys = useMemo(
    () => (view.place ?? "").split(",").filter(Boolean).slice(0, 2),
    [view.place],
  );
  const pickOf = (key: string | undefined): PlacePick | undefined => {
    if (!key || !compareRegister) return undefined;
    const c = compareRegister.cantons[key];
    if (c) return { key, name: c.name, kind: "canton", canton: key, lonLat: c.lonLat };
    const m = compareRegister.municipalities.find((x) => String(x.bfs) === key);
    return m
      ? { key, name: m.name, kind: "municipality", canton: m.canton, lonLat: m.lonLat }
      : undefined;
  };
  const setPlaces = (a: string | undefined, b: string | undefined) =>
    setPlace([a, b].filter(Boolean).join(",") || undefined);
  const [airLayer] = useState(() => airContribution(undefined));
  // statistics: the catalogue, the topic's map indicator, the register for names, quantile stops
  const isStats = STATS_TOPICS.has(topic);
  const catalog = useIndicatorCatalog(isStats);
  const mapIndicatorId = isStats ? MAP_INDICATOR[topic] : undefined;
  const indicator = useIndicator(
    mapIndicatorId && catalog?.indicators.some((i) => i.id === mapIndicatorId)
      ? mapIndicatorId
      : undefined,
  );
  const national = useIndicator(
    topic === "economy" && catalog?.indicators.some((i) => i.id === "kof-barometer")
      ? "kof-barometer"
      : undefined,
  );
  const register = useGeoRegister(isStats);
  const period = indicator && view.t && indicator.periods.includes(view.t) ? view.t : undefined;
  // hover extras are read at hover time: mutate the one object the contributions hold
  const [statsHover] = useState<{
    choropleth: { label: string; unit: string; source: string; decimals: number };
  }>(() => ({
    choropleth: { label: "", unit: "", source: "", decimals: 0 },
  }));
  useEffect(() => {
    if (!indicator) return;
    statsHover.choropleth = {
      label: indicator.meta.label.en ?? indicator.meta.label.de,
      unit: indicator.meta.unit,
      source: indicator.meta.attribution,
      decimals: indicator.meta.decimals,
    };
  }, [indicator, statsHover]);
  const [statsMuni] = useState(() =>
    choroplethContribution({
      id: "stats-muni",
      layer: "stats",
      topoUrl: "/geo/ch-2026.topo.json",
      object: "municipalities",
      scale: "dynamic",
      hoverExtras: statsHover,
    }),
  );
  const [statsCanton] = useState(() =>
    choroplethContribution({
      id: "stats-canton",
      layer: "stats",
      topoUrl: "/geo/ch-2026.topo.json",
      object: "cantons",
      scale: "dynamic",
      hoverExtras: statsHover,
    }),
  );
  const statsUpdate = useMemo(() => {
    if (!indicator) return undefined;
    const pi = period ? indicator.periods.indexOf(period) : -1;
    const vals =
      pi >= 0
        ? Object.fromEntries(
            Object.entries(indicator.values).flatMap(([k, arr]) =>
              typeof arr[pi] === "number" ? [[k, arr[pi] as number]] : [],
            ),
          )
        : latestValues(indicator).values;
    // only keys of the indicator's level: canton rows would skew the municipality quantiles
    const isCanton = (k: string) => /^[A-Z]{2}$/.test(k);
    const cells = Object.fromEntries(
      Object.entries(vals)
        .filter(([k]) => k !== "CH" && isCanton(k) === (indicator.meta.geoLevel === "canton"))
        .map(([k, v]) => [k, { value: v }]),
    );
    const stops = quantileStops(
      Object.values(cells).map((c) => c.value),
      sequentialRamp(accentOf(topic)),
    );
    return { cells, stops, level: indicator.meta.geoLevel };
  }, [indicator, period, topic]);
  const nameOf = useMemo(
    () => (key: string) =>
      register?.municipalities.find((m) => String(m.bfs) === key)?.name ??
      register?.cantons[key]?.name ??
      key,
    [register],
  );
  const statsFig = useMemo(
    () => (indicator ? { series: indicator, period, nameOf } : undefined),
    [indicator, period, nameOf],
  );
  const [hazardsLayer] = useState(() => hazardsContribution(undefined));
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
    () => [
      { contribution: choropleth, state: choroState },
      { contribution: airLayer, state: air },
      { contribution: hazardsLayer, state: hazards },
      {
        contribution: statsMuni,
        state: statsUpdate?.level === "municipality" ? statsUpdate : { cells: {} },
      },
      {
        contribution: statsCanton,
        state: statsUpdate?.level === "canton" ? statsUpdate : { cells: {} },
      },
    ],
    [
      choropleth,
      choroState,
      airLayer,
      air,
      hazardsLayer,
      hazards,
      statsMuni,
      statsCanton,
      statsUpdate,
    ],
  );
  const [quakeHover, setQuakeHover] = useState<QuakeHover | null>(null);
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
  // keyboard: [ ] topics · 1–4 modes · Esc back to NOW (docs/IA.md)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey
      )
        return;
      const order = TOPIC_ORDER_BUILT;
      const i = order.indexOf(topic);
      if (e.key === "]") setTopic(order[(i + 1) % order.length]!);
      else if (e.key === "[") setTopic(order[(i - 1 + order.length) % order.length]!);
      else if (e.key === "Escape") setTopic("now");
      else if (/^[1-4]$/.test(e.key)) {
        const m = Mode.options[Number(e.key) - 1]!;
        if (TOPICS[topic].modes.includes(m)) setMode(m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [topic, setTopic, setMode]);
  const radar = useRadarTimeline(weather);
  // the radar timeline is the WEATHER topic's TIMELINE instrument; elsewhere the map shows the latest frame
  const radarOn = topic === "weather" && mode === "timeline";
  const radarReset = radar.reset;
  useEffect(() => {
    if (!radarOn) radarReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the view changes
  }, [radarOn]);
  const placeA = pickOf(placeKeys[0]);
  const placeB = pickOf(placeKeys[1]);
  const compareFigures = (p: PlacePick | undefined): Figure[] => {
    if (!p) return [];
    if (isStats && indicator) return indicatorPlaceFigures(indicator, p.key, period);
    if (topic === "politics" && vote) return votePlaceFigures(vote, p.key);
    if ((topic === "weather" || topic === "water" || topic === "now") && p.lonLat) {
      const l = localSummary(p.lonLat, weather, hydrology);
      if (!l) return [];
      const out: Figure[] = [];
      if (l.temperature !== undefined)
        out.push({
          id: "temp",
          label: "Temperature",
          value: l.temperature,
          decimals: 1,
          unit: "°C",
          where: `${l.stationName} · ${l.distanceKm.toFixed(0)} km`,
        });
      if (l.gustKmh !== undefined)
        out.push({ id: "gust", label: "Gust", value: l.gustKmh, decimals: 0, unit: "km/h" });
      if (l.rain10min !== undefined)
        out.push({
          id: "rain",
          label: "Rain, 10 min",
          value: l.rain10min,
          decimals: 1,
          unit: "mm",
        });
      if (l.river?.discharge !== undefined)
        out.push({
          id: "discharge",
          label: "River",
          value: l.river.discharge,
          decimals: 0,
          unit: "m³/s",
          where: `${l.river.waterBody ?? ""} ${l.river.name}`.trim(),
        });
      if (l.river?.temp !== undefined)
        out.push({
          id: "water-temp",
          label: "Water",
          value: l.river.temp,
          decimals: 1,
          unit: "°C",
        });
      return out;
    }
    return [];
  };
  const figures = useMemo(
    () =>
      past
        ? figuresForSnapshot(topic, past, Date.now())
        : figuresFor(topic, {
            weather,
            hydrology,
            rail,
            seismic,
            politics,
            vote,
            energy,
            events,
            air,
            hazards,
            stats: statsFig,
          }),
    [
      past,
      topic,
      weather,
      hydrology,
      rail,
      seismic,
      politics,
      vote,
      energy,
      events,
      air,
      hazards,
      statsFig,
    ],
  );
  const voteStatus = past ? (
    <span className="label tnum">
      Snapshot · {formatTime(past.at)} ·{" "}
      <span className="freshness" data-state="stale">
        {formatAgo(Date.now() - new Date(past.at).getTime())}
      </span>
    </span>
  ) : topic === "politics" && vote ? (
    <span className="label tnum">
      Vote of {formatDate(vote.meta.date)} · {vote.status} · Source: BFS
    </span>
  ) : isStats && indicator ? (
    <span className="label tnum">
      {indicator.meta.label.en ?? indicator.meta.label.de} ·{" "}
      {period ?? latestValues(indicator).period} · {indicator.meta.attribution}
    </span>
  ) : undefined;
  return (
    <>
      <LiveMap
        weather={viewWeather}
        hydrology={viewHydrology}
        disruptions={viewDisruptions}
        presence={presence}
        muted={
          topic === "rail" ||
          topic === "hazards" ||
          topic === "events" ||
          mode === "charts" ||
          compareMode
        }
        focus={focus}
        radarFrame={radar.frame}
        contributions={contributions}
        onMapReady={(m) => {
          setMap(m);
          // QA hook: the software-WebGL harness reads sources and feature state through it
          (window as unknown as { __swissNowMap?: MapLibreMap }).__swissNowMap = m;
        }}
      />
      {presence.weather !== "off" ? <WindParticles map={map} weather={viewWeather} /> : null}
      {presence.energy !== "off" ? (
        <FlowLayer
          map={map}
          energy={past ? past.energy : energy}
          mode={presence.energy === "full" ? "full" : "quiet"}
        />
      ) : null}
      {presence.events !== "off" && !past ? (
        <EventMarkers
          map={map}
          events={events}
          mode={presence.events === "full" ? "full" : "quiet"}
        />
      ) : null}
      {compareMode ? (
        <CompareView
          register={compareRegister}
          a={{ place: placeA, figures: compareFigures(placeA) }}
          b={{ place: placeB, figures: compareFigures(placeB) }}
          onPickA={(p) => setPlaces(p.key, placeKeys[1])}
          onPickB={(p) => setPlaces(placeKeys[0], p.key)}
          title={`Compare · ${TOPICS[topic].label.en ?? topic}`}
        />
      ) : null}
      {mode === "charts" ? (
        <ChartsView
          topic={topic}
          energy={energy}
          stats={
            isStats
              ? { series: indicator, national, register, accent: accentOf(topic), period }
              : undefined
          }
        />
      ) : null}
      {presence.rail !== "off" && !past ? (
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
          seismic={viewSeismic}
          mode={presence.seismic === "full" ? "full" : "quiet"}
          onHover={setQuakeHover}
        />
      ) : null}
      {topic === "hazards" && quakeHover ? (
        <div className="hover-anchor">
          <QuakeHoverCard hover={quakeHover} />
        </div>
      ) : null}
      <TopicRail view={view} onSelect={setTopic} />
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
          ) : topic === "air" ? (
            <RampLegend scale="airIndex" label="Air index" />
          ) : topic === "hazards" ? (
            <RampLegend scale="dangerLevel" label="Danger level" />
          ) : isStats && statsUpdate && indicator ? (
            <DynamicRampLegend
              stops={statsUpdate.stops}
              label={indicator.meta.label.en ?? indicator.meta.label.de}
              unit={indicator.meta.unit ? ` ${indicator.meta.unit}` : ""}
              decimals={indicator.meta.decimals}
            />
          ) : null
        }
      >
        {snapshotMode ? (
          <SnapshotScrubber
            slots={tl.slots}
            index={tl.index}
            playing={tl.playing}
            onChange={(i) => {
              tl.setIndex(i);
              setTime(
                i === null
                  ? undefined
                  : tl.slots[i]?.url
                      .split("/")
                      .pop()
                      ?.replace(/\.json$/, ""),
              );
            }}
            onTogglePlay={() => {
              if (view.t) setTime(undefined);
              tl.togglePlay();
            }}
          />
        ) : null}
        {isStats && mode === "timeline" && indicator ? (
          <PeriodScrubber
            periods={indicator.periods}
            selected={period ?? latestValues(indicator).period}
            onChange={setTime}
            label={indicator.meta.periodKind === "month" ? "Month" : "Year"}
          />
        ) : null}
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
