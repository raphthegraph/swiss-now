"use client";

import type { LonLat } from "@swiss-now/core";
import { measurePath, type MeasuredPath } from "@swiss-now/motion/math";

/**
 * Route paths keyed by path id (immutable per GTFS build). A bundle of all active paths is loaded
 * first (one request); anything not in it is fetched lazily.
 */
export class RailPathStore {
  private paths = new Map<string, MeasuredPath | null>();
  private pending = new Map<string, Promise<void>>();
  private bundleLoaded = false;
  private bundleLoading: Promise<void> | undefined;
  onChange?: () => void;

  constructor(readonly baseUrl: string) {}

  get size(): number {
    let n = 0;
    for (const v of this.paths.values()) if (v) n++;
    return n;
  }

  /** Loads every path of the currently active trips in one request. */
  preload(bundleUrl: string): Promise<void> {
    if (this.bundleLoading) return this.bundleLoading;
    this.bundleLoading = fetch(bundleUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const { paths } = (await res.json()) as { paths: Record<string, LonLat[]> };
        for (const [id, coords] of Object.entries(paths)) {
          if (!this.paths.get(id) && coords.length >= 2) this.paths.set(id, measurePath(coords));
        }
        this.bundleLoaded = true;
        this.onChange?.();
      })
      .catch(() => {
        // fall back to lazy per-path loading
      })
      .finally(() => {
        this.bundleLoading = undefined;
      });
    return this.bundleLoading;
  }

  get(patternId: string): MeasuredPath | undefined {
    const p = this.paths.get(patternId);
    if (p === undefined && (this.bundleLoaded || !this.bundleLoading)) void this.load(patternId);
    return p ?? undefined;
  }

  private load(patternId: string): Promise<void> {
    let p = this.pending.get(patternId);
    if (p) return p;
    p = fetch(`${this.baseUrl}/${patternId}.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const feature = (await res.json()) as { geometry: { coordinates: LonLat[] } };
        this.paths.set(patternId, measurePath(feature.geometry.coordinates));
        this.onChange?.();
      })
      .catch(() => {
        this.paths.set(patternId, null);
      })
      .finally(() => this.pending.delete(patternId));
    this.pending.set(patternId, p);
    return p;
  }
}
