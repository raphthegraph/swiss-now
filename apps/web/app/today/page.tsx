import type { HydrologyState, RailState, SeismicState, WeatherState } from "@swiss-now/core";
import { getTodayStory } from "@/lib/story";
import { getWeatherState } from "@/lib/state/weather";
import { getHydrologyState } from "@/lib/state/hydrology";
import { getRailState } from "@/lib/state/rail";
import { getSeismicState } from "@/lib/state/seismic";
import { TodayStory } from "@/components/story/TodayStory";

export const dynamic = "force-dynamic";

/** "Switzerland Today": the auto-assembled story of the day, told over the live map. */
export default async function TodayPage() {
  const [story, w, h, r, q] = await Promise.all([
    getTodayStory(),
    getWeatherState().catch(() => undefined),
    getHydrologyState().catch(() => undefined),
    getRailState().catch(() => undefined),
    getSeismicState().catch(() => undefined),
  ]);
  if (!w) {
    return (
      <main className="page">
        <header className="masthead">
          <h1>Swiss Now · Today</h1>
        </header>
        <p className="where">Weather data is temporarily unavailable.</p>
      </main>
    );
  }
  return (
    <TodayStory
      story={story}
      weather={w as WeatherState}
      hydrology={h as HydrologyState | undefined}
      rail={r as RailState | undefined}
      seismic={q as SeismicState | undefined}
    />
  );
}
