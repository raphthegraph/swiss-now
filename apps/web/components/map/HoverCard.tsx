"use client";

import type { Freshness } from "@swiss-now/core";
import type { StationFeatureProps } from "@/lib/map/stations-geojson";
import { formatNumber, formatTime } from "@/lib/format";

export interface Hovered {
  props: StationFeatureProps;
  lonLat: [number, number];
  point: { x: number; y: number };
}

/** value · time · source — the honesty rule made visible (docs/PRODUCT_VISION.md §5.8). */
export function HoverCard({ hovered, freshness }: { hovered: Hovered; freshness: Freshness }) {
  const { props, point } = hovered;
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
