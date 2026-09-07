import { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CameraSpec } from "@swiss-now/core";
import { easeHouse } from "@swiss-now/motion/math";
import { maplibreColorExpression, legendTicks } from "@swiss-now/motion/scales";
import { SWITZERLAND_CAMERA, interpolateCamera } from "@swiss-now/motion/specs";
import { fontFamily, ground, layerAccent, typeScale } from "@swiss-now/motion/tokens";
import { Metric } from "@swiss-now/motion/svg";
import { weatherFixture } from "./weather-fixture";

// Same worker workaround as the web app (bundlers mis-resolve MapLibre's import.meta.url worker).
setWorkerUrl(staticFile("map/vendor/maplibre-gl-worker.mjs"));

type Props = { readonly title: string };

/** Camera route: the national resting view glides towards the Bern–Zürich corridor. */
const START: CameraSpec = { ...SWITZERLAND_CAMERA, zoom: 7.35 };
const END: CameraSpec = { center: [7.99, 47.16], zoom: 8.3, bearing: 0, pitch: 0 };
/** Plate is 2× the frame, so the zoom delta must stay ≤ 1 (render-stability.md). */
const PLATE_SCALE = 2;

export const PlateSpike = ({ title }: Props) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [handle] = useState(() => delayRender("Loading swiss-now-light map plate"));

  const plateW = width * PLATE_SCALE;
  const plateH = height * PLATE_SCALE;
  const baseZoom = Math.max(START.zoom, END.zoom);
  const plateCenter = useMemo<[number, number]>(
    () => [(START.center[0] + END.center[0]) / 2, (START.center[1] + END.center[1]) / 2],
    [],
  );

  // Frame-driven camera (house easing over the first two seconds, then hold).
  const t = easeHouse(interpolate(frame, [0, fps * 2], [0, 1], { extrapolateRight: "clamp" }));
  const camera = interpolateCamera(START, END, t);

  useEffect(() => {
    if (!containerRef.current) return;
    const m = new MapLibreMap({
      container: containerRef.current,
      style: staticFile("map/swiss-now-light.json"),
      center: plateCenter,
      zoom: baseZoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });
    m.on("load", () => {
      m.addSource("stations", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: weatherFixture.stations.flatMap((s) => {
            const o = weatherFixture.observations.find(
              (x) => x.stationId === s.id && x.parameter === "airTemperature",
            );
            return o
              ? [
                  {
                    type: "Feature" as const,
                    geometry: { type: "Point" as const, coordinates: s.lonLat },
                    properties: { temp: o.value },
                  },
                ]
              : [];
          }),
        },
      });
      m.addLayer({
        id: "stations",
        type: "circle",
        source: "stations",
        paint: {
          "circle-color": maplibreColorExpression("temp", "temperature") as never,
          "circle-radius": 9,
          "circle-stroke-color": ground.paper,
          "circle-stroke-width": 2,
        },
      });
      m.jumpTo({ center: plateCenter, zoom: baseZoom });
      m.once("idle", () => {
        setMap(m);
        continueRender(handle);
      });
    });
    // no m.remove() cleanup — it interferes with Remotion's render lifecycle (maps skill)
  }, [baseZoom, continueRender, handle, plateCenter]);

  // Fixed map plate: renderer camera stays still; the canvas moves with CSS translate + scale.
  const plateStyle = useMemo(() => {
    if (!map) return { transform: "none" };
    const p = map.project(camera.center);
    const scale = 2 ** (camera.zoom - baseZoom);
    return {
      transform: `translate(${width / 2 - p.x * scale}px, ${height / 2 - p.y * scale}px) scale(${scale})`,
      transformOrigin: "0 0",
    };
  }, [map, camera.center, camera.zoom, baseZoom, width, height]);

  const metricProgress = interpolate(frame, [fps * 0.4, fps * 1.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outro = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const warmest = weatherFixture.extremes.warmest;
  const coldest = weatherFixture.extremes.coldest;
  const name = (id: string) => weatherFixture.stations.find((s) => s.id === id)?.name.en ?? id;

  return (
    <AbsoluteFill
      style={{ background: ground.paper, overflow: "hidden", fontFamily: fontFamily.sans }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: plateW,
          height: plateH,
          ...plateStyle,
        }}
      >
        <div ref={containerRef} style={{ width: plateW, height: plateH }} />
      </div>

      {/* HUD — same tokens, same primitive as the website */}
      <AbsoluteFill style={{ opacity: outro }}>
        <div
          style={{
            position: "absolute",
            left: 96,
            right: 96,
            top: 72,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderBottom: `2px solid ${ground.ink}`,
            paddingBottom: 12,
            color: ground.ink,
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 500, letterSpacing: "-0.01em" }}>Swiss Now</span>
          <span
            style={{
              fontSize: typeScale.label.size * 2,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ground.graphite,
            }}
          >
            {title}
          </span>
        </div>

        <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
          {warmest ? (
            <Metric
              x={96}
              y={height - 120}
              label={`Warmest · ${name(warmest.stationId)}`}
              value={warmest.value}
              decimals={1}
              unit="°C"
              size="display"
              progress={metricProgress}
              color={layerAccent.weather}
            />
          ) : null}
          {coldest ? (
            <Metric
              x={width / 2}
              y={height - 120}
              label={`Coldest · ${name(coldest.stationId)}`}
              value={coldest.value}
              decimals={1}
              unit="°C"
              size="display"
              progress={metricProgress}
              color={ground.ink}
            />
          ) : null}
          {/* legend from the shared scale */}
          {legendTicks("temperature").map((tick, i, arr) => {
            const w = 360 / arr.length;
            return (
              <g
                key={tick.value}
                transform={`translate(${width - 96 - 360 + i * w} ${height - 96})`}
              >
                <rect width={w} height={10} fill={tick.color} />
                <text
                  y={30}
                  fontSize={16}
                  fill={ground.graphite}
                  style={{ fontFamily: fontFamily.sans }}
                >
                  {tick.value}°
                </text>
              </g>
            );
          })}
        </svg>
        <div
          style={{
            position: "absolute",
            right: 96,
            bottom: 40,
            fontSize: 18,
            color: ground.graphite,
          }}
        >
          Source: MeteoSwiss · © swisstopo
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
