import { useEffect, useMemo, useState } from "react";
import { useDelayRender } from "remotion";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { LonLat } from "@swiss-now/core";
import { projectOnPlate } from "@swiss-now/motion/math";
import { yesShareColor } from "@swiss-now/motion/scales";
import { ground } from "@swiss-now/motion/tokens";
import type { PlateCamera } from "./FixedMapPlate";

export interface ChoroplethPlateProps {
  topoUrl: string;
  /** BFS number → yes share in % */
  values: Record<string, number>;
  plate: PlateCamera;
  plateW: number;
  plateH: number;
  /** 0–1 reveal */
  progress: number;
}

type Ring = LonLat[];

/**
 * The vote chapter: municipality polygons as SVG paths in plate coordinates (they sit inside the
 * transformed plate like the map canvas), filled on the diverging yes-share ramp. Paths are built
 * once per chapter; the reveal fades them in.
 */
export function ChoroplethPlate({
  topoUrl,
  values,
  plate,
  plateW,
  plateH,
  progress,
}: ChoroplethPlateProps) {
  const { delayRender, continueRender } = useDelayRender();
  const [topo, setTopo] = useState<Topology | null>(null);
  const [handle] = useState(() =>
    delayRender("vote choropleth topology", { timeoutInMilliseconds: 60_000 }),
  );
  useEffect(() => {
    let cancelled = false;
    fetch(topoUrl)
      .then((r) => r.json())
      .then((t: Topology) => {
        if (!cancelled) setTopo(t);
      })
      .catch(() => setTopo(null))
      .finally(() => continueRender(handle));
    return () => {
      cancelled = true;
    };
  }, [topoUrl, continueRender, handle]);

  const paths = useMemo(() => {
    if (!topo) return [];
    const fc = feature(topo, topo.objects["municipalities"] as GeometryCollection);
    const project = (ll: LonLat) => {
      const p = projectOnPlate(ll, plate.center, plate.zoom, plateW, plateH);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    };
    const ring = (r: Ring) => `M${r.map(project).join("L")}Z`;
    return fc.features.map((f) => {
      const g = f.geometry;
      const d =
        g.type === "Polygon"
          ? g.coordinates.map((r) => ring(r as Ring)).join("")
          : g.type === "MultiPolygon"
            ? g.coordinates.map((poly) => poly.map((r) => ring(r as Ring)).join("")).join("")
            : "";
      const v = values[String(f.id)];
      return { id: String(f.id), d, fill: v === undefined ? "none" : yesShareColor(v) };
    });
  }, [topo, values, plate.center, plate.zoom, plateW, plateH]);

  if (!paths.length) return null;
  return (
    <svg
      width={plateW}
      height={plateH}
      style={{ position: "absolute", left: 0, top: 0 }}
      opacity={0.9 * progress}
    >
      {paths.map((p) => (
        <path key={p.id} d={p.d} fill={p.fill} stroke={ground.paper} strokeWidth={0.6} />
      ))}
    </svg>
  );
}
