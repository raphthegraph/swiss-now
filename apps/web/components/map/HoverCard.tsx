"use client";

import type { Freshness } from "@swiss-now/core";
import type { StationFeatureProps } from "@/lib/map/stations-geojson";
import type { HydroFeatureProps } from "@/lib/map/hydro-geojson";
import type { DisruptionFeatureProps } from "@/lib/map/disruptions-geojson";
import { formatNumber, formatTime } from "@/lib/format";

export interface Hovered {
  props: StationFeatureProps | HydroFeatureProps | DisruptionFeatureProps;
  lonLat: [number, number];
  point: { x: number; y: number };
}

/** value · time · source — the honesty rule made visible (docs/PRODUCT_VISION.md §5.8). */
export function HoverCard({ hovered, freshness }: { hovered: Hovered; freshness: Freshness }) {
  const { props, point } = hovered;
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
