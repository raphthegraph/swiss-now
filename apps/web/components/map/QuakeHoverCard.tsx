"use client";

import type { QuakeHover } from "./QuakeLayer";
import { formatNumber } from "@/lib/format";

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min ago`;
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function QuakeHoverCard({ hover }: { hover: QuakeHover }) {
  const { event: e, point } = hover;
  return (
    <div
      className="hover-card hover-card--quake"
      style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
    >
      <div className="hover-card__name">{e.headline.en ?? e.headline.de}</div>
      <div className="hover-card__value tnum">M {formatNumber(e.magnitude ?? 0, 1)}</div>
      <div className="hover-card__meta tnum">
        depth {formatNumber(e.depthKm ?? 0, 0)} km · {relative(e.startsAt)} ·{" "}
        {new Date(e.startsAt).toLocaleString("de-CH", {
          timeZone: "Europe/Zurich",
          dateStyle: "short",
          timeStyle: "short",
        })}
      </div>
      <div className="hover-card__meta">
        reviewed catalogue, published hours after the event · Source: SED / ETH Zurich
      </div>
    </div>
  );
}
