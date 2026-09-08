"use client";

import type { Freshness } from "@swiss-now/core";
import type { StationFeatureProps } from "@/lib/map/stations-geojson";
import type { HydroFeatureProps } from "@/lib/map/hydro-geojson";
import type { DisruptionFeatureProps } from "@/lib/map/disruptions-geojson";
import type { AirFeatureProps, PollenFeatureProps } from "@/lib/map/contributions/air";
import type { RegionFeatureProps, SnowFeatureProps } from "@/lib/map/contributions/hazards";
import { formatNumber, formatTime } from "@/lib/format";

/** A municipality of a choropleth: properties from the geo spine plus its feature state. */
export interface ChoroplethHoverProps {
  name: string;
  canton: string;
  value: number | null;
  turnout?: number | null;
  choropleth: { label: string; unit: string; source: string; decimals?: number };
}

export interface Hovered {
  props:
    | StationFeatureProps
    | HydroFeatureProps
    | DisruptionFeatureProps
    | ChoroplethHoverProps
    | AirFeatureProps
    | PollenFeatureProps
    | RegionFeatureProps
    | SnowFeatureProps;
  lonLat: [number, number];
  point: { x: number; y: number };
}

/** value · time · source — the honesty rule made visible (docs/PRODUCT_VISION.md §5.8). */
export function HoverCard({ hovered, freshness }: { hovered: Hovered; freshness: Freshness }) {
  const { props, point } = hovered;
  const at = (p: { observedAt?: string }) => (p.observedAt ? formatTime(p.observedAt) : "");
  const INDEX = ["", "good", "fair", "moderate", "poor", "very poor", "hazardous"];
  if ("air" in props) {
    const a = props;
    const parts = [
      a.pm25 !== undefined ? `PM2.5 ${formatNumber(a.pm25, 1)}` : null,
      a.pm10 !== undefined ? `PM10 ${formatNumber(a.pm10, 1)}` : null,
      a.no2 !== undefined ? `NO₂ ${formatNumber(a.no2, 1)}` : null,
      a.o3 !== undefined ? `O₃ ${formatNumber(a.o3, 1)}` : null,
    ].filter(Boolean);
    return (
      <div
        className="hover-card hover-card--air"
        style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
      >
        <div className="hover-card__name">
          {a.name} {a.tier === "citizen" ? <span className="label">citizen sensor</span> : null}
        </div>
        <div className="hover-card__value tnum">
          {a.index !== undefined ? `${a.index} · ${INDEX[a.index]}` : "—"}
          <span className="label"> air index</span>
        </div>
        <div className="hover-card__meta tnum">{parts.join(" · ")} µg/m³</div>
        <div className="hover-card__meta">
          <span className="tnum">{at(a)}</span>
          {a.tier === "citizen"
            ? " · low-cost hardware, indicative only · Sensor.Community"
            : " · Source: Stadt Zürich UGZ"}
        </div>
      </div>
    );
  }
  if ("pollen" in props) {
    const p = props;
    return (
      <div
        className="hover-card hover-card--air"
        style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
      >
        <div className="hover-card__name">{p.name}</div>
        <div className="hover-card__value tnum">
          {p.value !== undefined ? `${formatNumber(p.value, 0)} /m³` : "—"}
          <span className="label">
            {" "}
            {p.top ? p.top.replace("pollen", "").toLowerCase() : "pollen"}
          </span>
        </div>
        <div className="hover-card__meta">
          <span className="tnum">{at(p)}</span> · Source: MeteoSwiss
        </div>
      </div>
    );
  }
  if ("region" in props) {
    const r = props;
    return (
      <div
        className="hover-card hover-card--hazard"
        style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
      >
        <div className="hover-card__name">
          {r.name} {r.canton ? <span className="label">{r.canton}</span> : null}
        </div>
        <div className="hover-card__value tnum">
          level {r.level}
          <span className="label">
            {" "}
            {r.region === "fire" ? "forest-fire danger" : "avalanche danger"}
          </span>
        </div>
        <div className="hover-card__meta">
          {r.region === "fire" ? "Source: FOEN" : "Source: SLF"}
        </div>
      </div>
    );
  }
  if ("snow" in props) {
    const sn = props;
    return (
      <div
        className="hover-card hover-card--hazard"
        style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
      >
        <div className="hover-card__name">
          {sn.name}
          {sn.elevation !== undefined ? (
            <span className="tnum"> · {Math.round(sn.elevation)} m</span>
          ) : null}
        </div>
        <div className="hover-card__value tnum">
          {sn.depth !== undefined ? `${formatNumber(sn.depth, 0)} cm` : "—"}
          <span className="label"> snow depth</span>
        </div>
        <div className="hover-card__meta tnum">
          {sn.temp !== undefined ? `air ${formatNumber(sn.temp, 1)} °C · ` : ""}
          {at(sn)} · Source: SLF IMIS
        </div>
      </div>
    );
  }
  if ("choropleth" in props) {
    const c = props;
    return (
      <div
        className="hover-card hover-card--vote"
        style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
      >
        <div className="hover-card__name">
          {c.name} <span className="label">{c.canton}</span>
        </div>
        <div className="hover-card__value tnum">
          {c.value === null
            ? "—"
            : `${formatNumber(c.value, c.choropleth.decimals ?? 1)} ${c.choropleth.unit}`.trim()}
          <span className="label"> {c.choropleth.label}</span>
        </div>
        <div className="hover-card__meta tnum">
          {c.turnout !== undefined && c.turnout !== null
            ? `turnout ${formatNumber(c.turnout, 1)} %`
            : null}
          {` · ${c.choropleth.source}`}
        </div>
      </div>
    );
  }
  if ("disruption" in props) {
    const d = props;
    return (
      <div
        className="hover-card hover-card--disruption"
        style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
      >
        <div className="hover-card__name">{d.headline}</div>
        {d.description ? (
          <div className="hover-card__meta">{d.description.slice(0, 220)}</div>
        ) : null}
        <div className="hover-card__meta tnum">
          {formatTime(d.startsAt)}
          {d.endsAt ? ` – ${formatTime(d.endsAt)}` : ""}
          {" · Source: SBB"}
        </div>
      </div>
    );
  }
  if ("kind" in props) {
    const h = props;
    const dangerText = h.danger >= 2 ? ` · danger level ${h.danger}` : "";
    return (
      <div
        className="hover-card hover-card--water"
        style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
      >
        <div className="hover-card__name">
          {h.waterBody ? `${h.waterBody} · ` : ""}
          {h.name}
        </div>
        <div className="hover-card__value tnum">
          {h.discharge !== undefined
            ? `${formatNumber(h.discharge, h.discharge >= 100 ? 0 : 1)} m³/s`
            : h.level !== undefined
              ? `${formatNumber(h.level, 2)} m`
              : "—"}
        </div>
        <div className="hover-card__meta tnum">
          {h.level !== undefined && h.discharge !== undefined
            ? `level ${formatNumber(h.level, 2)} m a.s.l.`
            : null}
          {h.level !== undefined && h.discharge !== undefined && h.temp !== undefined
            ? " · "
            : null}
          {h.temp !== undefined ? `water ${formatNumber(h.temp)} °C` : null}
          {dangerText}
        </div>
        <div className="hover-card__meta">
          <span className="tnum">{h.observedAt ? formatTime(h.observedAt) : ""}</span>
          {" · "}
          <span className="freshness" data-state={freshness}>
            {freshness}
          </span>
          {" · Source: FOEN"}
        </div>
      </div>
    );
  }
  return (
    <div
      className="hover-card"
      style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
    >
      <div className="hover-card__name">
        {props.name}
        {props.elevation !== undefined ? (
          <span className="tnum"> · {Math.round(props.elevation)} m</span>
        ) : null}
      </div>
      <div className="hover-card__value tnum">
        {props.temp !== undefined ? `${formatNumber(props.temp)} °C` : "—"}
      </div>
      <div className="hover-card__meta tnum">
        {props.gust !== undefined ? `gust ${formatNumber(props.gust, 0)} km/h` : null}
        {props.gust !== undefined && props.rain !== undefined ? " · " : null}
        {props.rain !== undefined ? `rain ${formatNumber(props.rain)} mm/10 min` : null}
      </div>
      <div className="hover-card__meta">
        <span className="tnum">{props.observedAt ? formatTime(props.observedAt) : ""}</span>
        {" · "}
        <span className="freshness" data-state={freshness}>
          {freshness}
        </span>
        {" · Source: MeteoSwiss"}
      </div>
    </div>
  );
}
