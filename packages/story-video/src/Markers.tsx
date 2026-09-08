import type { StoryMarker } from "@swiss-now/core";
import {
  clamp01,
  easeHouse,
  projectOnPlate,
  pulseEnvelope,
  ringProgress,
  seededRandom,
} from "@swiss-now/motion/math";
import { magnitudeToRings, temperatureColor } from "@swiss-now/motion/scales";
import { fontFamily, ground, layerAccent } from "@swiss-now/motion/tokens";
import type { PlateCamera } from "./FixedMapPlate";

export interface MarkersProps {
  markers: StoryMarker[];
  plate: PlateCamera;
  plateW: number;
  plateH: number;
  /** Plate → frame transform pieces (same as the CSS transform on the plate). */
  scale: number;
  tx: number;
  ty: number;
  /** Frames since the sequence took ownership (0 at the cut). */
  localFrame: number;
  fps: number;
  width: number;
  height: number;
  portrait: boolean;
}

function markerColor(m: StoryMarker): string {
  switch (m.kind) {
    case "temperature":
      return m.value === undefined ? layerAccent.weather : temperatureColor(m.value);
    case "rain":
    case "snow":
      return layerAccent.rain;
    case "gust":
      return layerAccent.wind;
    case "river":
      return layerAccent.hydrology;
    case "quake":
      return layerAccent.seismic;
    case "disruption":
      return layerAccent.railDelay;
    default:
      return ground.ink;
  }
}

function formatValue(m: StoryMarker): string | undefined {
  if (m.value === undefined) return undefined;
  const decimals = m.kind === "temperature" || m.kind === "quake" ? 1 : 0;
  const v = m.value.toFixed(decimals);
  if (m.kind === "quake") return `M${v}`;
  return m.unit ? `${v}${m.unit === "°" ? "°" : ` ${m.unit}`}` : v;
}

/**
 * SVG data markers over the map plate. Positions come from pure Mercator math (no renderer state),
 * so they are exact for every frame; motion comes from the shared envelopes.
 */
export function Markers(p: MarkersProps) {
  const {
    markers,
    plate,
    plateW,
    plateH,
    scale,
    tx,
    ty,
    localFrame,
    fps,
    width,
    height,
    portrait,
  } = p;
  const tMs = (localFrame / fps) * 1000;
  const k = portrait ? 1 : 0.85; // landscape frames are wider; marks scale down a little
  const labelSize = 26 * k;
  const many = markers.length > 12;
  return (
    <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
      {markers.map((m) => {
        const pos = projectOnPlate(m.lonLat, plate.center, plate.zoom, plateW, plateH);
        const x = pos.x * scale + tx;
        const y = pos.y * scale + ty;
        if (x < -80 || y < -80 || x > width + 80 || y > height + 80) return null;
        // staggered entrance for dense fields; emphasised marks come in first
        const delay = m.emphasis || !many ? 0 : seededRandom(m.id)() * fps * 1.2;
        const a = easeHouse(clamp01((localFrame - delay) / (fps * 0.5)));
        if (a <= 0) return null;
        const color = markerColor(m);
        const r = (m.emphasis ? 11 : many ? 6 : 8) * k;
        const value = formatValue(m);
        return (
          <g key={m.id} transform={`translate(${x} ${y})`} opacity={a}>
            {m.kind === "quake" && m.value !== undefined
              ? Array.from({ length: magnitudeToRings(m.value).rings }, (_, i) => {
                  const rp = ringProgress(tMs, 2400, i, magnitudeToRings(m.value!).rings);
                  return (
                    <circle
                      key={i}
                      r={r + rp.radius * 90 * k}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5 * k}
                      opacity={rp.opacity}
                    />
                  );
                })
              : null}
            {m.kind === "river"
              ? [0, 1, 2].map((i) => {
                  const rp = ringProgress(tMs, 3000, i, 3);
                  return (
                    <circle
                      key={i}
                      r={r + rp.radius * 80 * k}
                      fill="none"
                      stroke={color}
                      strokeWidth={3 * k}
                      opacity={rp.opacity}
                    />
                  );
                })
              : null}
            {m.kind === "disruption" ||
            m.kind === "gust" ||
            m.kind === "rain" ||
            m.kind === "snow" ? (
              <circle
                r={r + pulseEnvelope(tMs, 1800) * 26 * k}
                fill={color}
                opacity={0.25 * (1 - pulseEnvelope(tMs, 1800))}
              />
            ) : null}
            <circle r={r} fill={color} stroke={ground.paper} strokeWidth={2.5 * k} />
            {m.emphasis && (m.label || value) ? (
              <text
                x={r + 12 * k}
                y={labelSize * 0.36}
                fontFamily={fontFamily.sans}
                fontSize={labelSize}
                fontWeight={500}
                fill={ground.ink}
                stroke={ground.paper}
                strokeWidth={6 * k}
                strokeLinejoin="round"
                style={{ paintOrder: "stroke" }}
              >
                {value ? <tspan fontWeight={600}>{value}</tspan> : null}
                {value && m.label ? " " : ""}
                {m.label ? <tspan fill={ground.graphite}>{m.label}</tspan> : null}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
