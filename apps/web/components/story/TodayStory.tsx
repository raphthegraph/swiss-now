"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type {
  Chapter,
  HydrologyState,
  RailState,
  SeismicState,
  StorySpec,
  WeatherState,
} from "@swiss-now/core";
import { LiveMap } from "@/components/map/LiveMap";
import { QuakeLayer } from "@/components/map/QuakeLayer";
import { TrainLayer } from "@/components/map/TrainLayer";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ActiveLayer } from "@/lib/layers";
import { useLayerState } from "@/lib/use-layer-state";
import { formatNumber } from "@/lib/format";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function layerFor(c: Chapter): ActiveLayer {
  return c.layer === "seismic"
    ? "quakes"
    : c.layer === "hydrology"
      ? "water"
      : c.layer === "rail"
        ? "rail"
        : "weather";
}

/**
 * The web-native Today mode: chapters scroll over the live map; the chapter in view steers the
 * camera and the active layer. Same StorySpec as the Remotion composition, different renderer.
 */
export function TodayStory({
  story,
  weather,
  hydrology,
  seismic,
}: {
  story: StorySpec;
  weather: WeatherState;
  hydrology?: HydrologyState | undefined;
  seismic?: SeismicState | undefined;
}) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // rail is ≈ 1.8 MB per state; load it in the browser instead of inlining it into the HTML
  const rail = useLayerState<RailState | undefined>("/api/state/rail", undefined, 60_000);
  const [current, setCurrent] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const els = refs.current.filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset["index"]));
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [story.chapters.length]);

  const chapter = story.chapters[current] ?? story.chapters[0]!;
  const active = layerFor(chapter);
  const focus = {
    lonLat: chapter.camera.center as [number, number],
    zoom: chapter.camera.zoom,
    key: `${chapter.id}`,
  };

  return (
    <div className="today">
      <div className="today__map">
        <LiveMap
          weather={weather}
          hydrology={hydrology}
          disruptions={rail?.disruptions}
          active={active}
          focus={focus}
          onMapReady={setMap}
        />
        {active === "rail" ? <TrainLayer map={map} rail={rail} mode="quiet" /> : null}
        {active === "quakes" ? <QuakeLayer map={map} seismic={seismic} mode="full" /> : null}
      </div>
      <header className="hud hud--top">
        <h1>
          <Link href="/">Swiss Now</Link>
        </h1>
        <span className="label">{story.title.en ?? story.title.de}</span>
      </header>
      <main className="today__chapters">
        <div className="today__spacer" aria-hidden="true" />
        {story.chapters.map((c, i) => (
          <motion.section
            key={c.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            className="chapter"
            data-active={i === current ? "true" : undefined}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.4, once: false }}
            transition={{ duration: 0.48, ease: EASE }}
          >
            <div className="label">
              {i + 1} / {story.chapters.length} · {c.layer}
            </div>
            <h2 className="chapter__headline">{c.headline.en ?? c.headline.de}</h2>
            {c.body ? <p className="chapter__body">{c.body.en ?? c.body.de}</p> : null}
            <ChapterFigures c={c} />
          </motion.section>
        ))}
        <footer className="chapter chapter--credits">
          <div className="label">Credits</div>
          <p className="chapter__body">{story.credits.join(" · ")}</p>
          <p className="chapter__body">
            Generated{" "}
            {new Date(story.generatedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}{" "}
            from today's snapshots. Positions of trains are estimated from timetable and live
            delays.
          </p>
        </footer>
        <div className="today__spacer" aria-hidden="true" />
      </main>
    </div>
  );
}

function ChapterFigures({ c }: { c: Chapter }) {
  const d = c.data as Record<string, unknown>;
  const fig = (label: string, value: string, unit = "") => (
    <div className="metric metric--hud" key={label}>
      <div className="label">{label}</div>
      <div className="value tnum">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
    </div>
  );
  const items: React.ReactNode[] = [];
  const ex = (k: string) => d[k] as { value: number } | undefined;
  if (c.type === "weather-summary" || c.type === "extremes") {
    if (ex("warmest")) items.push(fig("Warmest", formatNumber(ex("warmest")!.value), "°C"));
    if (ex("coldest")) items.push(fig("Coldest", formatNumber(ex("coldest")!.value), "°C"));
    if (typeof d["rainingShare"] === "number")
      items.push(fig("Raining over", formatNumber((d["rainingShare"] as number) * 100, 0), "%"));
  }
  if (c.type === "rainfall" && ex("wettest24h"))
    items.push(fig("24 h", formatNumber(ex("wettest24h")!.value, 0), "mm"));
  if (c.type === "rail") {
    if (typeof d["worstOnTime"] === "number")
      items.push(
        fig("On time, worst moment", formatNumber((d["worstOnTime"] as number) * 100, 0), "%"),
      );
    const w = d["worst"] as { delaySeconds: number } | undefined;
    if (w) items.push(fig("Largest delay", formatNumber(w.delaySeconds / 60, 0), "min"));
    if (typeof d["running"] === "number") items.push(fig("Trains now", String(d["running"])));
  }
  if (c.type === "river") {
    if (typeof d["discharge"] === "number")
      items.push(fig("Discharge", formatNumber(d["discharge"] as number, 0), "m³/s"));
    if (typeof d["dangerLevel"] === "number")
      items.push(fig("Danger level", String(d["dangerLevel"])));
  }
  if (c.type === "quake") {
    const e = d["event"] as { magnitude?: number; depthKm?: number } | undefined;
    if (e?.magnitude !== undefined) items.push(fig("Magnitude", formatNumber(e.magnitude, 1)));
    if (e?.depthKm !== undefined) items.push(fig("Depth", formatNumber(e.depthKm, 0), "km"));
  }
  if (c.type === "stat" && ex("gust"))
    items.push(fig("Gust", formatNumber(ex("gust")!.value, 0), "km/h"));
  if (c.type === "snow" && ex("snow"))
    items.push(fig("Snow depth", formatNumber(ex("snow")!.value, 0), "cm"));
  return items.length ? <div className="strip chapter__figures">{items}</div> : null;
}
