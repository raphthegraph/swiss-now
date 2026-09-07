import { Suspense } from "react";
import type { HydrologyState, WeatherState } from "@swiss-now/core";
import { getWeatherState } from "@/lib/state/weather";
import { getHydrologyState } from "@/lib/state/hydrology";
import { MapPage } from "@/components/map/MapPage";

export const revalidate = 300;

/** The stage: full-screen live map with the summary strip as HUD. */
export default async function HomePage() {
  let state: WeatherState | undefined;
  let hydrology: HydrologyState | undefined;
  let error: string | undefined;
  const [w, h] = await Promise.allSettled([getWeatherState(), getHydrologyState()]);
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
        <MapPage initial={state} initialHydrology={hydrology} />
      </Suspense>
    </main>
  );
}
