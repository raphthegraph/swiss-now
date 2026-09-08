"use client";

import { useT } from "@/lib/i18n/lang";
import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type ImageSource,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from "maplibre-gl";
import type { Point } from "geojson";
import type { Event, Field, HydrologyState, LayerId, WeatherState } from "@swiss-now/core";
import type { Presence } from "@swiss-now/core/topics";
import { duration } from "@swiss-now/motion/tokens";
import { easeHouse } from "@swiss-now/motion/math";
import { SWITZERLAND_BBOX } from "@swiss-now/motion/specs";
import type { StationFeatureProps } from "@/lib/map/stations-geojson";
import type { HydroFeatureProps } from "@/lib/map/hydro-geojson";
import type { DisruptionFeatureProps } from "@/lib/map/disruptions-geojson";
import type { MapContribution } from "@/lib/map/contributions/types";
import { weatherContribution } from "@/lib/map/contributions/weather";
import { waterContribution } from "@/lib/map/contributions/water";
import { disruptionsContribution } from "@/lib/map/contributions/disruptions";
import { HoverCard, type Hovered } from "./HoverCard";
import { AnimatePresence, motion } from "motion/react";

const STYLE_URL = "/map/swiss-now-light.json";
// Worker served as a static module (see scripts/copy-maplibre-worker.mjs) — bundlers mis-resolve import.meta.url.
setWorkerUrl("/map/vendor/maplibre-gl-worker.mjs");
const RADAR_SOURCES = ["radar-a", "radar-b"] as const;
const RADAR_LAYERS = ["radar-rain-a", "radar-rain-b"] as const;
const RADAR_OPACITY = 0.78;
const RADAR_FADE_MS = 220;
const FIT_PADDING = { top: 96, right: 48, bottom: 160, left: 48 };

/** MapLibre image sources take corners clockwise from the top-left. */
function fieldCorners([w, s, e, n]: [number, number, number, number]): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ];
}

/** Insert data rasters below the basemap's labels so place names stay legible. */
function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((l) => l.type === "symbol")?.id;
}

export type LayerPresence = Partial<Record<LayerId, Presence>>;

/** An extra contribution with its current state (topics beyond the built-in ones). */
export interface ContributionSlot {
  contribution: MapContribution<never>;
  state?: unknown;
}

export interface LiveMapProps {
  weather: WeatherState;
  hydrology?: HydrologyState | undefined;
  /** rail disruptions (SBB rail-traffic messages placed between their stations) */
  disruptions?: Event[] | undefined;
  /** Per layer: full (selected topic), quiet (NOW contributor) or off. */
  presence: LayerPresence;
  /** Desaturate the ground so an overlay (trains, quakes) carries the picture. */
  muted?: boolean | undefined;
  /** Camera target; changing it glides the camera with the house easing. `null` = whole country. */
  focus?: { lonLat: [number, number]; zoom: number; key: string } | null | undefined;
  /** Radar frame to show; defaults to the newest in `weather.fields`. */
  radarFrame?: Field | undefined;
  /** Additional topic contributions (installed once, updated when their state changes). */
  contributions?: ContributionSlot[] | undefined;
  /** Receives the map once its style has loaded (overlays such as WindParticles attach here). */
  onMapReady?: (map: MapLibreMap) => void;
  /** Called once per animation frame while the map renders; used by the FPS meter in Spike A. */
  onFrame?: (nowMs: number) => void;
}

/**
 * The stage. MapLibre GL owns the camera and the basemap; each topic contributes its own sources
 * and layers (lib/map/contributions) and renders in full, quietly or not at all according to
 * `presence` (docs/IA.md §2). React owns the HUD around it.
 */
export function LiveMap({
  weather,
  hydrology,
  disruptions,
  presence,
  muted,
  focus,
  radarFrame,
  contributions,
  onFrame,
  onMapReady,
}: LiveMapProps) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const activeRadar = useRef<0 | 1>(0);
  const shownFrameId = useRef<string | null>(null);
  const builtIn = useRef({
    weather: weatherContribution(weather),
    water: waterContribution(hydrology),
    disruptions: disruptionsContribution(disruptions),
  });
  const installed = useRef(new Set<string>());
  const lastState = useRef(new Map<string, unknown>());
  const hoverBound = useRef(new Set<string>());
  /** static props merged into hovered features per hover layer (e.g. what a choropleth shows) */
  const hoverExtras = useRef(new Map<string, Record<string, unknown>>());
  const hoverHandlers = useRef<{
    onMove: (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => void;
    onLeave: () => void;
  } | null>(null);

  const bindHover = (
    map: MapLibreMap,
    layers: string[] | undefined,
    extras?: Record<string, unknown>,
  ) => {
    const h = hoverHandlers.current;
    if (!h || !layers) return;
    for (const id of layers) {
      if (extras) hoverExtras.current.set(id, extras);
      if (hoverBound.current.has(id)) continue;
      hoverBound.current.add(id);
      map.on("mousemove", id, h.onMove);
      map.on("mouseleave", id, h.onLeave);
    }
  };
  const install = (map: MapLibreMap, c: MapContribution<never>) => {
    if (installed.current.has(c.id)) return;
    installed.current.add(c.id);
    c.install(map, { beforeId: firstSymbolLayerId(map) });
    bindHover(map, c.hoverLayers, c.hoverExtras);
  };

  // create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // MapLibre 6 requires WebGL2. Degrade honestly instead of taking the page down.
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2")) {
      setUnsupported(t("noWebgl"));
      return;
    }
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: STYLE_URL,
        bounds: SWITZERLAND_BBOX as [number, number, number, number],
        fitBoundsOptions: { padding: FIT_PADDING },
        minZoom: 6,
        maxZoom: 14,
        maxBounds: [
          [3.5, 44.5],
          [13.0, 49.0],
        ],
        attributionControl: { compact: true, customAttribution: "Source: MeteoSwiss" },
        fadeDuration: 150,
        canvasContextAttributes: { antialias: true },
      });
    } catch (e) {
      setUnsupported(t("mapFailed", { error: e instanceof Error ? e.message : String(e) }));
      return;
    }
    mapRef.current = map;

    map.on("load", () => {
      // precipitation radar: two alternating image sources so frame changes can crossfade
      const initial = radarFrame ?? weather.fields.find((f) => f.kind === "radar-rain-rate");
      if (initial) {
        RADAR_SOURCES.forEach((sourceId, i) => {
          map.addSource(sourceId, {
            type: "image",
            url: initial.imageUrl,
            coordinates: fieldCorners(initial.bounds),
          });
          map.addLayer(
            {
              id: RADAR_LAYERS[i]!,
              type: "raster",
              source: sourceId,
              paint: {
                "raster-opacity": i === 0 ? RADAR_OPACITY : 0,
                "raster-opacity-transition": { duration: RADAR_FADE_MS, delay: 0 },
                "raster-fade-duration": 0,
                "raster-resampling": "linear",
              },
            },
            firstSymbolLayerId(map),
          );
        });
        shownFrameId.current = initial.id;
      }

      // one hover handler for every contribution's hover layers
      let hoveredId: string | number | undefined;
      let hoveredSource = "";
      const onMove = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        if (hoveredId !== undefined && hoveredId !== f.id)
          map.setFeatureState({ source: hoveredSource, id: hoveredId }, { hover: false });
        hoveredId = f.id;
        hoveredSource = f.source;
        map.setFeatureState({ source: f.source, id: f.id as string }, { hover: true });
        map.getCanvas().style.cursor = "crosshair";
        // feature state carries choropleth values; the contribution may attach card metadata
        const extra = hoverExtras.current.get(f.layer.id);
        const p = { ...f.properties, ...(f.state ?? {}), ...(extra ?? {}) } as Hovered["props"];
        const coords = (
          f.geometry.type === "Point"
            ? (f.geometry as Point).coordinates
            : [e.lngLat.lng, e.lngLat.lat]
        ) as [number, number];
        setHovered({ props: p, lonLat: coords, point: map.project(coords) });
      };
      const onLeave = () => {
        if (hoveredId !== undefined && hoveredSource)
          map.setFeatureState({ source: hoveredSource, id: hoveredId }, { hover: false });
        hoveredId = undefined;
        map.getCanvas().style.cursor = "";
        setHovered(null);
      };
      hoverHandlers.current = { onMove, onLeave };
      // keep the card anchored while the camera moves
      map.on("move", () => {
        setHovered((h) => (h ? { ...h, point: map.project(h.lonLat) } : h));
      });

      const b = builtIn.current;
      install(map, b.weather as MapContribution<never>);
      install(map, b.water as MapContribution<never>);
      install(map, b.disruptions as MapContribution<never>);
      setReady(true);
      onMapReady?.(map);
    });

    if (onFrame) map.on("render", () => onFrame(performance.now()));

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; data updates flow through the effects below
  }, []);

  // push new data into the built-in contributions
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) builtIn.current.weather.update?.(map, weather);
  }, [weather, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready && hydrology) builtIn.current.water.update?.(map, hydrology);
  }, [hydrology, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) builtIn.current.disruptions.update?.(map, disruptions);
  }, [disruptions, ready]);

  // extra contributions: install once, update when their state identity changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !contributions) return;
    for (const slot of contributions) {
      install(map, slot.contribution);
      if (slot.state !== undefined && lastState.current.get(slot.contribution.id) !== slot.state) {
        lastState.current.set(slot.contribution.id, slot.state);
        slot.contribution.update?.(map, slot.state as never);
      }
      slot.contribution.setPresence(map, presence[slot.contribution.layer] ?? "off");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- presence is applied in the effect below too
  }, [contributions, ready]);

  // presence: the selected topic in full, NOW contributors quietly
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const b = builtIn.current;
    b.weather.setPresence(map, presence.weather ?? "off");
    b.water.setPresence(map, presence.hydrology ?? "off");
    b.disruptions.setPresence(map, presence.rail ?? "off");
    for (const slot of contributions ?? [])
      if (installed.current.has(slot.contribution.id))
        slot.contribution.setPresence(map, presence[slot.contribution.layer] ?? "off");
    RADAR_LAYERS.forEach((l) => {
      if (map.getLayer(l))
        map.setLayoutProperty(
          l,
          "visibility",
          presence.weather && presence.weather !== "off" ? "visible" : "none",
        );
    });
    map.getCanvas().style.filter = muted ? "saturate(0.6)" : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contributions are handled above
  }, [presence, muted, ready]);

  // camera glide to the focus place (or back to the country)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || focus === undefined) return;
    if (focus === null) {
      map.fitBounds(SWITZERLAND_BBOX as [number, number, number, number], {
        padding: FIT_PADDING,
        duration: duration.cameraGlide,
        easing: easeHouse,
      });
      return;
    }
    map.easeTo({
      center: focus.lonLat,
      zoom: focus.zoom,
      duration: duration.cameraGlide,
      easing: easeHouse,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key is the change trigger
  }, [focus?.key, ready]);

  // crossfade to the requested radar frame
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const frame = radarFrame ?? weather.fields.find((f) => f.kind === "radar-rain-rate");
    if (!frame || frame.id === shownFrameId.current) return;
    const next: 0 | 1 = activeRadar.current === 0 ? 1 : 0;
    const src = map.getSource(RADAR_SOURCES[next]) as ImageSource | undefined;
    if (!src) return;
    src.updateImage({ url: frame.imageUrl, coordinates: fieldCorners(frame.bounds) });
    // let the new image decode before swapping opacities
    const swap = () => {
      map.setPaintProperty(RADAR_LAYERS[next], "raster-opacity", RADAR_OPACITY);
      map.setPaintProperty(RADAR_LAYERS[activeRadar.current], "raster-opacity", 0);
      activeRadar.current = next;
      shownFrameId.current = frame.id;
    };
    if (map.isSourceLoaded(RADAR_SOURCES[next])) swap();
    else map.once("sourcedata", swap);
  }, [radarFrame, weather.fields, ready]);

  return (
    <div className="map-root">
      <div
        ref={containerRef}
        className="map-canvas"
        aria-label={t("mapOfSwitzerland")}
        role="img"
      />
      {unsupported ? (
        <div className="map-unsupported" role="status">
          <span className="label">Map unavailable</span>
          <p>{unsupported}</p>
        </div>
      ) : null}
      <AnimatePresence>
        {hovered ? (
          <motion.div
            key="hover"
            className="hover-anchor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.hover / 1000 }}
          >
            <HoverCard hovered={hovered} freshness={weather.freshness} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
