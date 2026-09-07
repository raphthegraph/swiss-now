import Link from "next/link";
import type { WeatherState } from "@swiss-now/core";
import { formatNumber, formatTime } from "@/lib/format";

/** National summary — the default view already answers "what is it like out there". */
export function SummaryStrip({ state }: { state: WeatherState }) {
  const name = (id: string) => state.stations.find((s) => s.id === id)?.name.en ?? id;
  const items: { label: string; value: string; unit: string; where: string }[] = [];
  if (state.extremes.warmest)
    items.push({
      label: "Warmest",
      value: formatNumber(state.extremes.warmest.value),
      unit: "°C",
      where: name(state.extremes.warmest.stationId),
    });
  if (state.extremes.coldest)
    items.push({
      label: "Coldest",
      value: formatNumber(state.extremes.coldest.value),
      unit: "°C",
      where: name(state.extremes.coldest.stationId),
    });
  if (state.extremes.windiestGust)
    items.push({
      label: "Strongest gust",
      value: formatNumber(state.extremes.windiestGust.value, 0),
      unit: "km/h",
      where: name(state.extremes.windiestGust.stationId),
    });
  if (state.rainingShare !== undefined)
    items.push({
      label: "Stations reporting rain",
      value: formatNumber(state.rainingShare * 100, 0),
      unit: "%",
      where: `${state.stations.length} stations`,
    });

  return (
    <>
      <header className="hud hud--top">
        <h1>Swiss Now</h1>
        <span className="label tnum">
          Switzerland · {formatTime(state.observedAt)} ·{" "}
          <span className="freshness" data-state={state.freshness}>
            {state.freshness}
          </span>
        </span>
      </header>
      <section className="hud hud--bottom" aria-label="Switzerland right now">
        <div className="strip">
          {items.map((m) => (
            <div className="metric metric--hud" key={m.label}>
              <div className="label">{m.label}</div>
              <div className="value tnum">
                {m.value}
                <span className="unit">{m.unit}</span>
              </div>
              <div className="where">{m.where}</div>
            </div>
          ))}
        </div>
        <div className="colophon colophon--hud">
          <span>Source: MeteoSwiss</span>
          <span>© swisstopo</span>
          <Link href="/status">Status</Link>
        </div>
      </section>
    </>
  );
}
