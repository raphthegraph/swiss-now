"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Snapshot, type SnapshotMeta } from "@swiss-now/core/snapshot";

export interface SnapshotTimeline {
  /** oldest → newest */
  slots: SnapshotMeta[];
  /** index into `slots`, or null for live */
  index: number | null;
  snapshot: Snapshot | undefined;
  loading: boolean;
  playing: boolean;
  setIndex: (i: number | null) => void;
  togglePlay: () => void;
}

const idOf = (m: SnapshotMeta) =>
  m.url
    .split("/")
    .pop()!
    .replace(/\.json$/, "");

/**
 * The 48-hour snapshot timeline (10-minute slots written by visitors): the list is fetched when
 * TIMELINE opens, the selected snapshot on demand and cached; playback steps every 400 ms.
 */
export function useSnapshotTimeline(
  enabled: boolean,
  selectedId: string | undefined,
): SnapshotTimeline & { selectedId: string | undefined } {
  const [slots, setSlots] = useState<SnapshotMeta[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const cache = useRef(new Map<string, Snapshot>());
  const [localIndex, setLocalIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/snapshots")
      .then((r) => (r.ok ? r.json() : { snapshots: [] }))
      .then((j: { snapshots: SnapshotMeta[] }) => !cancelled && setSlots(j.snapshots))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // the URL's `t` wins; otherwise the local selection
  const index = useMemo(() => {
    if (selectedId) {
      const i = slots.findIndex((m) => idOf(m) === selectedId);
      return i >= 0 ? i : null;
    }
    return localIndex;
  }, [selectedId, slots, localIndex]);

  useEffect(() => {
    if (index === null || !enabled) return setSnapshot(undefined);
    const meta = slots[index];
    if (!meta) return;
    const hit = cache.current.get(meta.url);
    if (hit) return setSnapshot(hit);
    let cancelled = false;
    setLoading(true);
    fetch(meta.url)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((j: unknown) => {
        if (cancelled || !j) return;
        const parsed = Snapshot.safeParse(j);
        if (parsed.success) {
          cache.current.set(meta.url, parsed.data);
          setSnapshot(parsed.data);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [index, slots, enabled]);

  useEffect(() => {
    if (!playing || !slots.length) return;
    const t = setInterval(() => {
      setLocalIndex((i) => {
        const next = (i ?? -1) + 1;
        if (next >= slots.length) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, 400);
    return () => clearInterval(t);
  }, [playing, slots.length]);

  const setIndex = useCallback((i: number | null) => setLocalIndex(i), []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const sel = index !== null && slots[index] ? idOf(slots[index]!) : undefined;
  return { slots, index, snapshot, loading, playing, setIndex, togglePlay, selectedId: sel };
}

export const snapshotIdOf = idOf;
