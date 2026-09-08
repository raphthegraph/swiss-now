"use client";

import { useEffect } from "react";
import { SNAPSHOT_PING_MS } from "@/lib/snapshots/writer-constants";

/**
 * Visitor-driven snapshot persistence on the free tier: while a tab is visible it asks the
 * writer every 10 minutes to store the current composite snapshot (the Today story's input).
 * There is no timeline UI any more; the snapshots serve the story and, later, baselines.
 */
export function useSnapshotPing() {
  useEffect(() => {
    const ping = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await fetch("/api/snapshot", { method: "POST" });
      } catch {
        // the next visitor or ping will try again
      }
    };
    void ping();
    const t = setInterval(ping, SNAPSHOT_PING_MS);
    return () => clearInterval(t);
  }, []);
}
