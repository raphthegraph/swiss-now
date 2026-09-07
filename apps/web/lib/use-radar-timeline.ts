"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Field, WeatherState } from "@swiss-now/core";

const PLAYBACK_FPS = 4;

/**
 * Radar frame selection and playback. Frames come from WeatherState.fields (newest first from
 * the API) and are exposed oldest → newest. While the viewer sits on the latest frame, new data
 * keeps them on the latest; a manual scrub position is preserved across polls.
 */
export function useRadarTimeline(weather: WeatherState) {
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

  const frame: Field | undefined = frames[index] ?? frames[frames.length - 1];
  return { frames, index, frame, playing, scrubTo, togglePlay };
}
