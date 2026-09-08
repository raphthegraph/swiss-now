"use client";

import type { LonLat } from "@swiss-now/core";
import { measurePath, type MeasuredPath } from "@swiss-now/motion/math";

/** Lazily fetched, measured route paths keyed by pattern id (immutable per GTFS build). */
export class RailPathStore {
  private paths = new Map<string, MeasuredPath | null>();
  private pending = new Map<string, Promise<void>>();
  constructor(private baseUrl: string) {}

  get(patternId: string): MeasuredPath | undefined {
    const p = this.paths.get(patternId);
    if (p === undefined) void this.load(patternId);
    return p ?? undefined;
  }

  raw(patternId: string): LonLat[] | undefined {
    return this.paths.get(patternId)?.coordinates;
  }

  private load(patternId: string): Promise<void> {
    let p = this.pending.get(patternId);
    if (p) return p;
    p = fetch(`${this.baseUrl}/${patternId}.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const feature = (await res.json()) as { geometry: { coordinates: LonLat[] } };
        this.paths.set(patternId, measurePath(feature.geometry.coordinates));
      })
      .catch(() => {
        this.paths.set(patternId, null);
      })
      .finally(() => this.pending.delete(patternId));
    this.pending.set(patternId, p);
    return p;
  }
}
