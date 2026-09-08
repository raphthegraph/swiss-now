"use client";

import { useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/lang";

/** Zoom and locate, as white squares at the right edge of the map (docs/DESIGN.md). */
export function MapControls({
  map,
  onLocate,
}: {
  map: MapLibreMap | null;
  onLocate: (lonLat: [number, number]) => void;
}) {
  const { t } = useT();
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocate([pos.coords.longitude, pos.coords.latitude]);
      },
      () => setLocating(false),
      { maximumAge: 600_000, timeout: 8000 },
    );
  };
  return (
    <div className="map-controls" role="group" aria-label={t("mapOfSwitzerland")}>
      <button
        type="button"
        className="map-controls__button"
        aria-label={t("zoomIn")}
        onClick={() => map?.zoomIn()}
      >
        <Plus size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="map-controls__button"
        aria-label={t("zoomOut")}
        onClick={() => map?.zoomOut()}
      >
        <Minus size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="map-controls__button map-controls__button--locate"
        aria-label={t("useLocation")}
        aria-busy={locating}
        onClick={locate}
      >
        <LocateFixed size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}
