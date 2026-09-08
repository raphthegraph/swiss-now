import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Event } from "@swiss-now/core";

export interface DisruptionFeatureProps {
  id: string;
  disruption: true;
  headline: string;
  description?: string;
  severity: number;
  startsAt: string;
  endsAt?: string;
  affects?: string;
}

/** Each disruption becomes its line (or point) plus a point at each named station for hovering. */
export function disruptionsToGeoJSON(
  events: Event[],
): FeatureCollection<Geometry, DisruptionFeatureProps> {
  const features: Feature<Geometry, DisruptionFeatureProps>[] = [];
  for (const e of events) {
    const props: DisruptionFeatureProps = {
      id: e.id,
      disruption: true,
      headline: e.headline.en ?? e.headline.de,
      severity: e.severity,
      startsAt: e.startsAt,
    };
    if (e.description) props.description = e.description.en ?? e.description.de;
    if (e.endsAt) props.endsAt = e.endsAt;
    if (e.affects?.length) props.affects = e.affects.join(" – ");
    features.push({ type: "Feature", id: e.id, geometry: e.geometry, properties: props });
    if (e.geometry.type === "LineString") {
      for (const [i, c] of e.geometry.coordinates.entries()) {
        features.push({
          type: "Feature",
          id: `${e.id}:${i}`,
          geometry: { type: "Point", coordinates: c },
          properties: props,
        });
      }
    }
  }
  return { type: "FeatureCollection", features };
}
