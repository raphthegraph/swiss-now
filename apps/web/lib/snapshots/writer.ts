import {
  buildSnapshot,
  snapshotSlot,
  summarizeEnergy,
  summarizeEvents,
  summarizeRail,
  type SnapshotMeta,
} from "@swiss-now/core/snapshot";
import { currentDelay } from "@swiss-now/core/data-sources/transit";
import { getWeatherState } from "@/lib/state/weather";
import { getHydrologyState } from "@/lib/state/hydrology";
import { getRailState } from "@/lib/state/rail";
import { getSeismicState } from "@/lib/state/seismic";
import { getEnergyState } from "@/lib/state/energy";
import { getEventsState } from "@/lib/state/events";
import { snapshotStore } from "./store";

let inFlight: Promise<SnapshotMeta | undefined> | undefined;

/**
 * Writes a snapshot for the current 10-minute slot if none exists yet. Called by visitors' browsers
 * (one request per 10 min per open tab, coalesced here) and by a GitHub Actions ping once deployed.
 * Never throws: a failed layer is simply absent from that snapshot.
 */
export async function maybeWriteSnapshot(
  now = new Date(),
): Promise<{ written: boolean; latest: SnapshotMeta | undefined }> {
  const store = snapshotStore();
  const slot = snapshotSlot(now);
  const latest = await store.latest();
  if (latest && new Date(latest.at).getTime() >= slot.getTime()) return { written: false, latest };
  if (!inFlight) {
    inFlight = (async () => {
      const [w, h, r, q, en, ev] = await Promise.allSettled([
        getWeatherState(),
        getHydrologyState(),
        getRailState(),
        getSeismicState(),
        getEnergyState(),
        getEventsState(),
      ]);
      const snap = buildSnapshot({
        now,
        weather: w.status === "fulfilled" ? w.value : undefined,
        hydrology: h.status === "fulfilled" ? h.value : undefined,
        rail: r.status === "fulfilled" ? summarizeRail(r.value, now, currentDelay) : undefined,
        seismic: q.status === "fulfilled" ? q.value : undefined,
        energy: en.status === "fulfilled" ? summarizeEnergy(en.value) : undefined,
        events: ev.status === "fulfilled" ? summarizeEvents(ev.value) : undefined,
      });
      return store.write(snap);
    })().finally(() => {
      inFlight = undefined;
    });
  }
  const meta = await inFlight;
  return { written: true, latest: meta };
}
