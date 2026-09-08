"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Field, WeatherState } from "@swiss-now/core";

const PLAYBACK_FPS = 4;

/**
 * Radar frame selection and playback. Frames come from WeatherState.fields (newest first from
 * the API) and are exposed oldest → newest. While the viewer sits on the latest frame, new data
 * keeps them on the latest; a manual scrub position is preserved across polls.
 */
/** Frames the ambient loop cycles through when nobody scrubs: the last 40 minutes. */
const AMBIENT_FRAMES = 8;
const AMBIENT_STEP_MS = 650;
const AMBIENT_DWELL_MS = 1800;

export function useRadarTimeline(weather: WeatherState, opts: { ambient?: boolean } = {}) {
  const frames = useMemo(
    () =>
      weather.fields
        .filter((f) => f.kind === "radar-rain-rate")
        .slice()
        .sort((a, b) => (a.validAt < b.validAt ? -1 : 1)),
    [weather.fields],
  );
  const [index, setIndex] = useState(() => Math.max(0, frames.length - 1));
  const [playing, setPlaying] = useState(false);
  const followLatest = useRef(true);

  // follow the newest frame when it changes and the viewer has not scrubbed away
  useEffect(() => {
    if (followLatest.current) setIndex(Math.max(0, frames.length - 1));
    else setIndex((i) => Math.min(i, Math.max(0, frames.length - 1)));
  }, [frames.length, frames[frames.length - 1]?.id]);

  // playback loop
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, 1000 / PLAYBACK_FPS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  // ambient motion: the rain of the last 40 minutes drifts across the map, then rests on now
  useEffect(() => {
    if (!opts.ambient || playing || frames.length < 3) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const first = Math.max(0, frames.length - AMBIENT_FRAMES);
    const tick = () => {
      if (!followLatest.current) return;
      setIndex((i) => {
        const next = i >= frames.length - 1 ? first : i + 1;
        timer = window.setTimeout(
          tick,
          next === frames.length - 1 ? AMBIENT_DWELL_MS : AMBIENT_STEP_MS,
        );
        return next;
      });
    };
    timer = window.setTimeout(tick, AMBIENT_DWELL_MS);
    return () => clearTimeout(timer);
  }, [opts.ambient, playing, frames.length]);

  // warm the browser cache so scrubbing is instant (frames are immutable and CDN-cached)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const imgs = frames.map((f) => {
      const img = new Image();
      img.decoding = "async";
      img.src = f.imageUrl;
      return img;
    });
    return () => imgs.forEach((img) => (img.src = ""));
  }, [frames]);

  const scrubTo = (i: number) => {
    followLatest.current = i >= frames.length - 1;
    setIndex(i);
  };
  const togglePlay = () => {
    setPlaying((p) => {
      const next = !p;
      followLatest.current = !next; // resume following when playback stops
      return next;
    });
  };

  /** Back to the newest frame and follow it again (used when the radar timeline leaves the screen). */
  const reset = () => {
    followLatest.current = true;
    setPlaying(false);
    setIndex(Math.max(0, frames.length - 1));
  };

  const frame: Field | undefined = frames[index] ?? frames[frames.length - 1];
  return { frames, index, frame, playing, scrubTo, togglePlay, reset };
}
