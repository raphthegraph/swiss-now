"use client";

import { useEffect, useRef } from "react";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { EventsState, NewsEvent } from "@swiss-now/core";

const CATEGORY_LABEL: Record<NewsEvent["category"], string> = {
  fire: "Fire",
  accident: "Accident",
  "natural-hazard": "Natural hazard",
  avalanche: "Avalanche",
  crime: "Police",
  police: "Police",
  news: "News",
};
const MAX_MARKERS = 60;

export interface EventMarkersProps {
  map: MapLibreMap | null;
  events: EventsState | undefined;
  mode: "full" | "quiet";
}

/**
 * Events as typographic markers (HTML, so the house type and CSS motion apply): category in small
 * caps, place in ink, opacity decaying over 24 hours. Quiet presence (NOW) keeps the last six
 * hours with confidence ≥ 0.8, at most twelve. Canton-centroid places render as a label only.
 */
export function EventMarkers({ map, events, mode }: EventMarkersProps) {
  const markers = useRef(new Map<string, Marker>());

  useEffect(() => {
    if (!map) return;
    const now = Date.now();
    const list = (events?.events ?? [])
      .filter((e) => e.place)
      .filter((e) =>
        mode === "quiet"
          ? e.place!.confidence >= 0.8 && now - new Date(e.publishedAt).getTime() < 6 * 3_600_000
          : true,
      )
      .slice(0, mode === "quiet" ? 12 : MAX_MARKERS);
    const keep = new Set(list.map((e) => e.id));
    for (const [id, m] of markers.current)
      if (!keep.has(id)) (m.remove(), markers.current.delete(id));
    list.forEach((e, i) => {
      const age = (now - new Date(e.publishedAt).getTime()) / 3_600_000;
      const opacity = Math.max(0.35, 1 - age / 30);
      let m = markers.current.get(e.id);
      if (!m) {
        const el = document.createElement("a");
        el.className = `event-marker event-marker--${e.place!.method === "canton-centroid" ? "canton" : "point"}`;
        el.href = e.url;
        el.target = "_blank";
        el.rel = "noopener";
        el.dataset["confidence"] = e.place!.confidence.toFixed(2);
        el.dataset["category"] = e.category;
        el.title = e.headline.de;
        el.innerHTML = `<span class="event-marker__dot"></span><span class="event-marker__label"><span class="event-marker__cat">${CATEGORY_LABEL[e.category]}</span><span class="event-marker__place">${escapeHtml(e.place!.name)}</span></span>`;
        el.style.animationDelay = `${Math.min(i, 20) * 40}ms`;
        m = new Marker({ element: el, anchor: "left", offset: [6, 0] })
          .setLngLat(e.place!.lonLat)
          .addTo(map);
        markers.current.set(e.id, m);
      }
      m.getElement().style.opacity = String(mode === "quiet" ? opacity * 0.85 : opacity);
      m.getElement().style.zIndex = String(1000 - Math.min(999, Math.round(age)));
    });
    return () => {
      if (!map.getStyle()) markers.current.clear();
    };
  }, [map, events, mode]);

  useEffect(
    () => () => {
      for (const m of markers.current.values()) m.remove();
      markers.current.clear();
    },
    [],
  );
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
