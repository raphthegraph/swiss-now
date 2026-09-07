import { Suspense } from "react";
import type { WeatherState } from "@swiss-now/core";
import { getWeatherState } from "@/lib/state/weather";
import { MapPage } from "@/components/map/MapPage";

export const revalidate = 300;

/** The stage: full-screen live map with the summary strip as HUD. */
export default async function HomePage() {
  let state: WeatherState | undefined;
  let error: string | undefined;
  try {
    state = await getWeatherState();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
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
        <MapPage initial={state} />
      </Suspense>
    </main>
  );
}
