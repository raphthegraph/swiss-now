import Link from "next/link";
import type { WeatherState } from "@swiss-now/core";
import { getSource } from "@swiss-now/core";
import { getWeatherState, WEATHER_TTL_SECONDS } from "@/lib/state/weather";
import { formatNumber, formatTime } from "@/lib/format";

export const revalidate = 300;

/**
 * Phase 0 home: the summary strip before the map exists. Real data, no placeholders.
 * The full-screen map arrives with Spike A (Phase 0, item 3).
 */
export default async function HomePage() {
  let state: WeatherState | undefined;
  let error: string | undefined;
  try {
    state = await getWeatherState();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const stationName = (id: string) => state?.stations.find((s) => s.id === id)?.name.en ?? id;
  const source = getSource("geoadmin-messwerte");

  return (
    <main className="page">
      <header className="masthead">
        <h1>Swiss Now</h1>
        <span className="label tnum">
          {state ? (
            <>
              Switzerland · {formatTime(state.observedAt)} ·{" "}
              <span className="freshness" data-state={state.freshness}>
                {state.freshness}
              </span>
            </>
          ) : (
            <span className="freshness" data-state="outage">
              outage
            </span>
          )}
        </span>
      </header>

      {state ? (
        <section className="metrics" aria-label="Switzerland right now">
          {state.extremes.warmest && (
            <Metric
              label="Warmest"
              value={formatNumber(state.extremes.warmest.value)}
              unit="°C"
              where={stationName(state.extremes.warmest.stationId)}
            />
          )}
          {state.extremes.coldest && (
            <Metric
              label="Coldest"
              value={formatNumber(state.extremes.coldest.value)}
              unit="°C"
              where={stationName(state.extremes.coldest.stationId)}
            />
          )}
          {state.extremes.windiestGust && (
            <Metric
              label="Strongest gust"
              value={formatNumber(state.extremes.windiestGust.value, 0)}
              unit="km/h"
              where={stationName(state.extremes.windiestGust.stationId)}
            />
          )}
          {state.rainingShare !== undefined && (
            <Metric
              label="Stations reporting rain"
              value={formatNumber(state.rainingShare * 100, 0)}
              unit="%"
              where={`${state.stations.length} stations · last 10 minutes`}
            />
          )}
        </section>
      ) : (
        <section className="metrics">
          <div className="metric">
            <div className="label">Weather</div>
            <div className="where">Upstream unavailable: {error}</div>
          </div>
        </section>
      )}

      <footer className="colophon">
        <span>{source.attribution}</span>
        <span>© swisstopo</span>
        <span className="tnum">refreshes every {WEATHER_TTL_SECONDS / 60} min</span>
        <Link href="/status">Status</Link>
        <a href="https://github.com/raphthegraph/swiss-now">Source</a>
      </footer>
    </main>
  );
}

function Metric({
  label,
  value,
  unit,
  where,
}: {
  label: string;
  value: string;
  unit: string;
  where: string;
}) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value tnum">
        {value}
        <span className="unit">{unit}</span>
      </div>
      <div className="where">{where}</div>
    </div>
  );
}
