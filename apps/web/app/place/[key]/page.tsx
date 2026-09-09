import { notFound } from "next/navigation";
import { getWeatherState } from "@/lib/state/weather";
import { getHydrologyState } from "@/lib/state/hydrology";
import { getRailState } from "@/lib/state/rail";
import { getAirState } from "@/lib/state/air";
import { getEventsState } from "@/lib/state/events";
import { getPoliticsState } from "@/lib/state/politics";
import { snapshotStore } from "@/lib/snapshots/store";
import { snapshotId } from "@swiss-now/core/snapshot";
import { buildPlace } from "@/lib/place";
import { PlaceView } from "@/components/place/PlaceView";

export const dynamic = "force-dynamic";

/** One municipality or canton: everything the app knows about it, on one page. */
export default async function PlacePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[A-Z]{2}$|^\d{1,5}$/.test(key)) notFound();
  const now = new Date();
  const [w, h, r, a, e, p, latest] = await Promise.allSettled([
    getWeatherState(),
    getHydrologyState(),
    getRailState(),
    getAirState(),
    getEventsState(),
    getPoliticsState(),
    snapshotStore()
      .latest()
      .then((m) => (m ? snapshotStore().read(snapshotId(new Date(m.at))) : undefined)),
  ]);
  const ok = <T,>(x: PromiseSettledResult<T>) => (x.status === "fulfilled" ? x.value : undefined);
  const bundle = await buildPlace(key, {
    now,
    weather: ok(w),
    hydrology: ok(h),
    rail: ok(r),
    air: ok(a),
    events: ok(e),
    politics: ok(p),
    latestSnapshot: ok(latest) ?? undefined,
  });
  if (!bundle) notFound();
  return <PlaceView bundle={bundle} />;
}
