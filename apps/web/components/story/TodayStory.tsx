"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
import { presenceFor, type TopicId } from "@swiss-now/core/topics";
import { useLayerState } from "@/lib/use-layer-state";
import { chapterFigures } from "@swiss-now/core/story";
import { formatNumber } from "@/lib/format";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// Remotion Player + MapLibre plate: browser-only, loaded when the section renders
const StoryPlayer = dynamic(() => import("./StoryPlayer").then((m) => m.StoryPlayer), {
  ssr: false,
});

function topicFor(c: Chapter): TopicId {
  return c.layer === "seismic"
    ? "hazards"
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
  const topic = topicFor(chapter);
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
          presence={{
            weather: presenceFor(topic, "weather"),
            hydrology: presenceFor(topic, "hydrology"),
            rail: presenceFor(topic, "rail"),
          }}
          muted={topic === "rail" || topic === "hazards"}
          focus={focus}
          onMapReady={setMap}
        />
        {topic === "rail" ? <TrainLayer map={map} rail={rail} mode="quiet" /> : null}
        {topic === "hazards" ? <QuakeLayer map={map} seismic={seismic} mode="full" /> : null}
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
        <section className="chapter chapter--video">
          <div className="label">The video version</div>
          <p className="chapter__body">
            The same chapters as a vertical "Switzerland Today" video: one Remotion composition fed
            by this story, rendered locally for social media and playable here.
          </p>
          <StoryPlayer story={story} />
        </section>
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
  const items = chapterFigures(c);
  if (!items.length) return null;
  return (
    <div className="strip chapter__figures">
      {items.map((f) => (
        <div className="metric metric--hud" key={f.label}>
          <div className="label">{f.label}</div>
          <div className="value tnum">
            {formatNumber(f.value, f.decimals)}
            {f.unit ? <span className="unit">{f.unit}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
