"use client";

import type { Freshness } from "@swiss-now/core";
import type { TrainHover } from "./TrainLayer";
import { formatNumber, formatTime } from "@/lib/format";

/** Line · train · destination · delay · next stop · how the position was derived. */
export function TrainHoverCard({
  hover,
  freshness,
  stopName,
}: {
  hover: TrainHover;
  freshness: Freshness;
  stopName: (id: string) => string;
}) {
  const { trip, position: p, point } = hover;
  const next = trip.stops[p.lastStopIndex + 1] ?? trip.stops[trip.stops.length - 1];
  const delayMin = p.delaySeconds / 60;
  return (
    <div
      className="hover-card hover-card--rail"
      style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
    >
      <div className="hover-card__name">
        {trip.routeShortName}
        {trip.trainNumber ? <span className="tnum"> {trip.trainNumber}</span> : null}
        {trip.headsign ? <span> → {trip.headsign}</span> : null}
      </div>
      <div
        className="hover-card__value tnum"
        style={{ color: delayMin >= 3 ? "var(--sn-accent-rail-delay)" : undefined }}
      >
        {p.delaySeconds >= 60
          ? `+${formatNumber(delayMin, 0)} min`
          : p.delaySeconds <= -60
            ? `${formatNumber(delayMin, 0)} min`
            : "on time"}
      </div>
      <div className="hover-card__meta tnum">
        {p.dwelling ? "at " : "next "}
        {next ? stopName(next.stopId) : "—"}
        {next
          ? ` · ${formatTime(next.scheduledArrival)}${next.delaySeconds >= 60 ? ` (+${Math.round(next.delaySeconds / 60)})` : ""}`
          : ""}
      </div>
      <div className="hover-card__meta">
        position interpolated from timetable + live delays ·{" "}
        <span className="freshness" data-state={freshness}>
          {freshness}
        </span>
      </div>
    </div>
  );
}
