import { Suspense } from "react";
import type { HydrologyState, RailState, WeatherState } from "@swiss-now/core";
import { getRailState } from "@/lib/state/rail";
import { getWeatherState } from "@/lib/state/weather";
import { getHydrologyState } from "@/lib/state/hydrology";
import { MapPage } from "@/components/map/MapPage";

export const revalidate = 300;

/** The stage: full-screen live map with the summary strip as HUD. */
export default async function HomePage() {
  let state: WeatherState | undefined;
  let hydrology: HydrologyState | undefined;
  let rail: RailState | undefined;
  let error: string | undefined;
  const [w, h, r] = await Promise.allSettled([
    getWeatherState(),
    getHydrologyState(),
    getRailState(),
  ]);
  if (r.status === "fulfilled") rail = r.value;
  if (w.status === "fulfilled") state = w.value;
  else error = w.reason instanceof Error ? w.reason.message : String(w.reason);
  if (h.status === "fulfilled") hydrology = h.value;
  if (!state) {
    return (
      <main className="page">
        <header className="masthead">
          <h1>Swiss Now</h1>
          <span className="freshness" data-state="outage">
            outage
          </span>
        </header>
        <p className="where">Weather data is temporarily unavailable: {error}</p>
      </main>
    );
  }
  return (
    <main className="stage">
      <Suspense fallback={null}>
        <MapPage initial={state} initialHydrology={hydrology} initialRail={rail} />
      </Suspense>
    </main>
  );
}
