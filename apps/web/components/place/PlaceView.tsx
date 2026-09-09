"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "motion/react";
import * as Plot from "@observablehq/plot";
import { ArrowLeft, CloudSun, Landmark, MapPin, TrainFront, Waves, Wind } from "lucide-react";
import { EVENT_CATEGORY, pick } from "@swiss-now/core/i18n";
import { parseSnapshotId } from "@swiss-now/core/snapshot";
import { ground, layerAccent } from "@swiss-now/motion/tokens";
import type { PlaceBundle } from "@/lib/place";
import { formatAgo, formatDate, formatNumber, formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";
import { Wordmark } from "@/components/brand/Wordmark";
import { LangSwitch } from "@/components/hud/LangSwitch";
import { PlotFigure } from "@/components/charts/PlotFigure";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const reveal = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE, delay: 0.06 * i },
});

function Sparkline({ history }: { history: NonNullable<PlaceBundle["history"]> }) {
  const rows = useMemo(
    () =>
      history.slots
        .map((s, i) => ({ t: parseSnapshotId(s)!, v: history.temperature[i] }))
        .filter((d): d is { t: Date; v: number } => typeof d.v === "number"),
    [history],
  );
  const options = useMemo<Plot.PlotOptions>(
    () => ({
      height: 120,
      marginLeft: 36,
      marginRight: 12,
      x: { type: "time", label: null, ticks: 4 },
      y: { label: null, grid: true, nice: true, tickFormat: (v: number) => `${v}°` },
      marks: [
        Plot.areaY(rows, {
          x: "t",
          y: "v",
          fill: layerAccent.weather,
          fillOpacity: 0.08,
          curve: "monotone-x",
        }),
        Plot.lineY(rows, {
          x: "t",
          y: "v",
          stroke: layerAccent.weather,
          strokeWidth: 1.5,
          curve: "monotone-x",
        }),
        Plot.dot(rows.slice(-1), { x: "t", y: "v", fill: layerAccent.weather, r: 3.5 }),
        Plot.ruleY([0], { stroke: ground.mist }),
      ],
    }),
    [rows],
  );
  if (rows.length < 3) return null;
  return <PlotFigure options={options} title="" />;
}

/** The place page: one municipality or canton across every topic (docs/DEPTH_PLAN.md). */
export function PlaceView({ bundle: b }: { bundle: PlaceBundle }) {
  const { t, l, lang } = useT();
  const w = b.weather;
  const v = w?.values ?? {};
  let i = 0;
  return (
    <main className="place">
      <header className="topbar topbar--page">
        <h1 className="topbar__brand">
          <Link href="/">
            <Wordmark />
          </Link>
        </h1>
        <Link className="topbar__back" href={`/?place=${b.key}`}>
          <ArrowLeft size={16} strokeWidth={1.75} /> <span>{t("place.backToMap")}</span>
        </Link>
        <div className="topbar__status">
          <LangSwitch />
        </div>
      </header>

      <div className="place__body">
        <motion.section className="place__head" {...reveal(i++)}>
          <div className="label">
            {b.kind === "canton" ? t("place.canton") : t("place.municipality")} · {b.cantonName}
          </div>
          <h2 className="place__name">{b.name}</h2>
          <div className="place__meta tnum">
            {b.lonLat[1].toFixed(3)}° N · {b.lonLat[0].toFixed(3)}° E
            {w?.observedAt
              ? ` · ${t("place.observedAt", { time: formatTime(w.observedAt, lang) })}`
              : ""}
          </div>
        </motion.section>

        <div className="place__grid">
          <motion.section className="card" {...reveal(i++)}>
            <h3 className="card__title">
              <CloudSun size={18} strokeWidth={1.75} /> {t("place.weather")}
            </h3>
            {w ? (
              <>
                <div className="card__hero tnum">
                  {v.airTemperature !== undefined ? formatNumber(v.airTemperature, 1) : "–"}
                  <span className="unit">°C</span>
                </div>
                <dl className="facts tnum">
                  {v.windGust !== undefined ? (
                    <>
                      <dt>{t("place.gust")}</dt>
                      <dd>{formatNumber(v.windGust, 0)} km/h</dd>
                    </>
                  ) : null}
                  {v.windSpeed !== undefined ? (
                    <>
                      <dt>{t("place.wind")}</dt>
                      <dd>{formatNumber(v.windSpeed, 0)} km/h</dd>
                    </>
                  ) : null}
                  {v.relativeHumidity !== undefined ? (
                    <>
                      <dt>{t("place.humidity")}</dt>
                      <dd>{formatNumber(v.relativeHumidity, 0)} %</dd>
                    </>
                  ) : null}
                  {v.precipitation10min !== undefined ? (
                    <>
                      <dt>{t("place.rain10")}</dt>
                      <dd>{formatNumber(v.precipitation10min, 1)} mm</dd>
                    </>
                  ) : null}
                  {v.sunshineDuration10min !== undefined ? (
                    <>
                      <dt>{t("place.sunshine")}</dt>
                      <dd>{formatNumber(v.sunshineDuration10min, 0)} min</dd>
                    </>
                  ) : null}
                  {v.pressureQNH !== undefined ? (
                    <>
                      <dt>{t("place.pressure")}</dt>
                      <dd>{formatNumber(v.pressureQNH, 0)} hPa</dd>
                    </>
                  ) : null}
                  {v.snowDepth !== undefined ? (
                    <>
                      <dt>{t("place.snow")}</dt>
                      <dd>{formatNumber(v.snowDepth, 0)} cm</dd>
                    </>
                  ) : null}
                </dl>
                {b.history ? (
                  <div className="card__chart">
                    <div className="label">{t("place.last24h")}</div>
                    <Sparkline history={b.history} />
                  </div>
                ) : null}
                <p className="card__source">
                  {t("place.nearestStation", { name: w.stationName, km: w.distanceKm })} · Source:
                  MeteoSwiss
                </p>
              </>
            ) : (
              <p className="card__empty">{t("place.noData")}</p>
            )}
          </motion.section>

          <motion.section className="card" {...reveal(i++)}>
            <h3 className="card__title">
              <Waves size={18} strokeWidth={1.75} /> {t("place.water")}
            </h3>
            {b.river ? (
              <>
                <div className="card__hero tnum">
                  {b.river.discharge !== undefined ? formatNumber(b.river.discharge, 0) : "–"}
                  <span className="unit">m³/s</span>
                </div>
                <dl className="facts tnum">
                  <dt>{t("place.river")}</dt>
                  <dd>{`${b.river.waterBody ?? ""} ${b.river.name}`.trim()}</dd>
                  {b.river.temp !== undefined ? (
                    <>
                      <dt>{t("place.waterTemp")}</dt>
                      <dd>{formatNumber(b.river.temp, 1)} °C</dd>
                    </>
                  ) : null}
                  {b.river.level !== undefined ? (
                    <>
                      <dt>{t("place.level")}</dt>
                      <dd>{formatNumber(b.river.level, 2)} m</dd>
                    </>
                  ) : null}
                  {b.river.danger !== undefined ? (
                    <>
                      <dt>{t("place.danger")}</dt>
                      <dd>{b.river.danger}</dd>
                    </>
                  ) : null}
                </dl>
                <p className="card__source">Source: FOEN</p>
              </>
            ) : (
              <p className="card__empty">{t("place.noRiver")}</p>
            )}
          </motion.section>

          <motion.section className="card" {...reveal(i++)}>
            <h3 className="card__title">
              <Wind size={18} strokeWidth={1.75} /> {t("place.air")}
            </h3>
            {b.air ? (
              <>
                <div className="card__hero tnum">
                  {b.air.index ?? "–"}
                  <span className="unit">
                    {b.air.index ? t(`index.${b.air.index}` as "index.1") : t("airIndex")}
                  </span>
                </div>
                <dl className="facts tnum">
                  {b.air.pm25 !== undefined ? (
                    <>
                      <dt>PM2.5</dt>
                      <dd>{formatNumber(b.air.pm25, 1)} µg/m³</dd>
                    </>
                  ) : null}
                  <dt>{t("place.sensor")}</dt>
                  <dd>
                    {b.air.stationName} · {b.air.distanceKm} km
                    {b.air.tier === "citizen" ? ` · ${t("citizenSensor")}` : ""}
                  </dd>
                </dl>
                <p className="card__source">
                  {b.air.tier === "citizen"
                    ? "Source: Sensor.Community"
                    : "Source: Stadt Zürich UGZ"}
                </p>
              </>
            ) : (
              <p className="card__empty">{t("place.noAir")}</p>
            )}
          </motion.section>

          <motion.section className="card card--wide" {...reveal(i++)}>
            <h3 className="card__title">
              <TrainFront size={18} strokeWidth={1.75} /> {t("place.departures")}
            </h3>
            {b.rail && b.rail.departures.length ? (
              <table className="board tnum">
                <tbody>
                  {b.rail.departures.map((d, k) => {
                    const delayMin = Math.round(d.delaySeconds / 60);
                    return (
                      <tr
                        key={`${d.line}-${d.scheduled}-${k}`}
                        className={d.cancelled ? "board__cancelled" : ""}
                      >
                        <td className="board__time">{formatTime(d.scheduled, lang)}</td>
                        <td className="board__delay">
                          {d.cancelled ? t("place.cancelled") : delayMin >= 1 ? `+${delayMin}` : ""}
                        </td>
                        <td className="board__line">{d.line}</td>
                        <td className="board__to">{d.headsign ?? ""}</td>
                        <td className="board__stop">{d.stopName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="card__empty">{t("place.noDepartures")}</p>
            )}
            <p className="card__source">
              {t("interpolatedNote")} · Source: opentransportdata.swiss
            </p>
          </motion.section>

          <motion.section className="card" {...reveal(i++)}>
            <h3 className="card__title">
              <MapPin size={18} strokeWidth={1.75} /> {t("place.events")}
            </h3>
            {b.events.length ? (
              <ul className="feed">
                {b.events.map((e) => (
                  <li key={e.id}>
                    <a href={e.url} target="_blank" rel="noopener">
                      <span className="label">
                        {pick(EVENT_CATEGORY[e.category].one, lang)} · {e.place?.name} ·{" "}
                        {formatAgo(Date.now() - new Date(e.publishedAt).getTime(), lang)}
                      </span>
                      <span className="feed__headline">{l(e.headline)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card__empty">{t("place.noEvents")}</p>
            )}
          </motion.section>

          <motion.section className="card" {...reveal(i++)}>
            <h3 className="card__title">
              <Landmark size={18} strokeWidth={1.75} /> {t("place.figures")}
            </h3>
            {b.stats.length ? (
              <div className="figures">
                {b.stats.map((s) => (
                  <div className="figures__row" key={s.id}>
                    <div className="label">{l(s.label)}</div>
                    <div className="figures__values tnum">
                      {s.figures.map((f) => (
                        <span key={f.id} className="figures__item">
                          <strong>{f.text ?? formatNumber(f.value, f.decimals)}</strong>
                          {f.unit && !f.text ? <span className="unit">{f.unit}</span> : null}
                          {l(f.label) !== l(s.label) ? (
                            <span className="figures__label">{l(f.label)}</span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="card__empty">{t("place.noData")}</p>
            )}
            <p className="card__source">Source: BFS</p>
          </motion.section>

          {b.votes.length ? (
            <motion.section className="card card--wide" {...reveal(i++)}>
              <h3 className="card__title">
                <Landmark size={18} strokeWidth={1.75} /> {t("place.votes")}
              </h3>
              <ul className="votes">
                {b.votes.map((vt) => {
                  const yes = vt.figures.find((f) => f.id === "yes");
                  const vs = vt.figures.find((f) => f.id === "vs-national");
                  return (
                    <li key={vt.meta.id}>
                      <div className="label tnum">{formatDate(vt.meta.date, lang)}</div>
                      <div className="votes__title">{l(vt.meta.title)}</div>
                      {yes ? (
                        <div className="votes__bar">
                          <span
                            className="votes__fill"
                            style={{ width: `${Math.max(0, Math.min(100, yes.value))}%` }}
                          />
                          <span className="votes__value tnum">
                            {formatNumber(yes.value, 1)} % {t("yes")}
                            {vs
                              ? ` · ${vs.text ?? formatNumber(vs.value, 1)} ${t("place.vsCountry")}`
                              : ""}
                          </span>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="card__source">Source: BFS · swissvotes.ch</p>
            </motion.section>
          ) : null}
        </div>
        <p className="place__foot label">
          {t("place.generated", { time: formatTime(b.generatedAt, lang) })} ·{" "}
          <Link href="/status">{t("status")}</Link>
        </p>
      </div>
    </main>
  );
}
