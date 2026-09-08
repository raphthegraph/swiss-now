import Link from "next/link";
import type { HydrologyState, RailState, SeismicState, WeatherState } from "@swiss-now/core";
import { getSeismicState } from "@/lib/state/seismic";
import { getRailState } from "@/lib/state/rail";
import { getHydrologyState } from "@/lib/state/hydrology";
import { listSources } from "@swiss-now/core";
import { getWeatherState } from "@/lib/state/weather";
import { formatTime } from "@/lib/format";

export const revalidate = 60;

/** Source health and licence register. Reads the same cached state as the API. */
export default async function StatusPage() {
  let weather: WeatherState | undefined;
  let weatherError: string | undefined;
  let hydrology: HydrologyState | undefined;
  let hydrologyError: string | undefined;
  let rail: RailState | undefined;
  let railError: string | undefined;
  let seismic: SeismicState | undefined;
  let seismicError: string | undefined;
  const [w, h, r, q] = await Promise.allSettled([
    getWeatherState(),
    getHydrologyState(),
    getRailState(),
    getSeismicState(),
  ]);
  if (r.status === "fulfilled") rail = r.value;
  else railError = r.reason instanceof Error ? r.reason.message : String(r.reason);
  if (q.status === "fulfilled") seismic = q.value;
  else seismicError = q.reason instanceof Error ? q.reason.message : String(q.reason);
  if (w.status === "fulfilled") weather = w.value;
  else weatherError = w.reason instanceof Error ? w.reason.message : String(w.reason);
  if (h.status === "fulfilled") hydrology = h.value;
  else hydrologyError = h.reason instanceof Error ? h.reason.message : String(h.reason);
  const sources = listSources();
  const cadence = (s: number) =>
    s >= 86_400
      ? `${Math.round(s / 86_400)} d`
      : s >= 3600
        ? `${Math.round(s / 3600)} h`
        : `${Math.round(s / 60)} min`;

  return (
    <main className="page">
      <header className="masthead">
        <h1>
          <Link href="/">Swiss Now</Link> · Status
        </h1>
        <span className="label">{sources.length} sources registered</span>
      </header>

      <section>
        <h2 className="label">Live layers</h2>
        <table className="sources">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Freshness</th>
              <th>Observed</th>
              <th>Stations</th>
              <th>Observations</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>weather</td>
              <td>
                <span className="freshness" data-state={weather?.freshness ?? "outage"}>
                  {weather?.freshness ?? "outage"}
                </span>
              </td>
              <td className="tnum">{weather ? formatTime(weather.observedAt) : weatherError}</td>
              <td className="tnum">{weather?.stations.length ?? "–"}</td>
              <td className="tnum">{weather?.observations.length ?? "–"}</td>
            </tr>
            <tr>
              <td>hydrology</td>
              <td>
                <span className="freshness" data-state={hydrology?.freshness ?? "outage"}>
                  {hydrology?.freshness ?? "outage"}
                </span>
              </td>
              <td className="tnum">
                {hydrology ? formatTime(hydrology.observedAt) : hydrologyError}
              </td>
              <td className="tnum">{hydrology?.stations.length ?? "–"}</td>
              <td className="tnum">{hydrology?.observations.length ?? "–"}</td>
            </tr>
            <tr>
              <td>rail</td>
              <td>
                <span className="freshness" data-state={rail?.freshness ?? "outage"}>
                  {rail?.freshness ?? "outage"}
                </span>
              </td>
              <td className="tnum">{rail ? formatTime(rail.observedAt) : railError}</td>
              <td className="tnum">{rail ? `${rail.activeTrips.length} trips` : "–"}</td>
              <td className="tnum">{rail?.gtfsBuild ?? "–"}</td>
            </tr>
            <tr>
              <td>seismic</td>
              <td>
                <span className="freshness" data-state={seismic?.freshness ?? "outage"}>
                  {seismic?.freshness ?? "outage"}
                </span>
              </td>
              <td className="tnum">{seismic ? formatTime(seismic.observedAt) : seismicError}</td>
              <td className="tnum">
                {seismic ? `${seismic.events.length} events / ${seismic.windowDays} d` : "–"}
              </td>
              <td className="tnum">
                {seismic?.latestEventAt ? formatTime(seismic.latestEventAt) : "–"}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className="label" style={{ marginTop: "var(--sn-space-7)" }}>
          Source register
        </h2>
        <table className="sources">
          <thead>
            <tr>
              <th>Source</th>
              <th>Provider</th>
              <th>Cadence</th>
              <th>Licence</th>
              <th>Commercial use</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={s.url}>{s.name}</a>
                </td>
                <td>{s.provider}</td>
                <td className="tnum">{cadence(s.cadenceSeconds)}</td>
                <td>{s.license}</td>
                <td>{s.commercialUse}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="colophon">
        <span>Freshness: live ≤ 1.5× cadence · aging ≤ 3× · stale ≤ 12× · outage beyond</span>
      </footer>
    </main>
  );
}
