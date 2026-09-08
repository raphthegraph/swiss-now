"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Snapshot, SnapshotMeta } from "@swiss-now/core/snapshot";
import { SNAPSHOT_PING_MS } from "@/lib/snapshots/writer-constants";

/**
 * The timeline: keeps the snapshot list fresh, pings the writer every 10 minutes while visible
 * (visitor-driven persistence on the free tier), and loads the snapshot the viewer scrubs to.
 * `index === null` means "now" (live state).
 */
export function useTimeline() {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const cache = useRef(new Map<string, Snapshot>());

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/snapshots");
      if (res.ok) setSnapshots(((await res.json()) as { snapshots: SnapshotMeta[] }).snapshots);
    } catch {
      // keep the previous list
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await fetch("/api/snapshot", { method: "POST" });
      } catch {
        // the next visitor or ping will try again
      }
      if (!cancelled) await refreshList();
    };
    void ping();
    const t = setInterval(ping, SNAPSHOT_PING_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [refreshList]);

  useEffect(() => {
    if (index === null) {
      setSnapshot(null);
      return;
    }
    const meta = snapshots[index];
    if (!meta) return;
    const cached = cache.current.get(meta.url);
    if (cached) {
      setSnapshot(cached);
      return;
    }
    let cancelled = false;
    fetch(meta.url)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Snapshot | null) => {
        if (!s || cancelled) return;
        cache.current.set(meta.url, s);
        setSnapshot(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [index, snapshots]);

  const marks = useMemo(() => {
    // NOW ← 1h ← 3h ← 6h ← 12h ← TODAY, as indices into the list (nearest snapshot at or before)
    if (snapshots.length === 0) return [];
    const now = Date.now();
    const targets: [string, number][] = [
      ["1h", 1],
      ["3h", 3],
      ["6h", 6],
      ["12h", 12],
      ["Today", hoursSinceLocalMidnight(now)],
    ];
    const out: { label: string; index: number }[] = [];
    for (const [label, h] of targets) {
      const t = now - h * 3_600_000;
      let best = -1;
      for (let i = 0; i < snapshots.length; i++)
        if (new Date(snapshots[i]!.at).getTime() <= t) best = i;
      if (best >= 0 && !out.some((o) => o.index === best)) out.push({ label, index: best });
    }
    return out;
  }, [snapshots]);

  return { snapshots, index, setIndex, snapshot, marks, refreshList };
}

function hoursSinceLocalMidnight(nowMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}
