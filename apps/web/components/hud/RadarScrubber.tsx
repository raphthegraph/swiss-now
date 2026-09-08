"use client";

import type { Field } from "@swiss-now/core";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

export interface RadarScrubberProps {
  /** oldest → newest */
  frames: Field[];
  index: number;
  playing: boolean;
  onChange: (index: number) => void;
  onTogglePlay: () => void;
}

/**
 * The radar timeline: 5-minute composites over the last three hours. A hairline scrubber in the
 * HUD; playback loops the sequence at 4 frames/s.
 */
export function RadarScrubber({
  frames,
  index,
  playing,
  onChange,
  onTogglePlay,
}: RadarScrubberProps) {
  const { t, lang } = useT();
  if (frames.length < 2) return null;
  const current = frames[index] ?? frames[frames.length - 1]!;
  const isLatest = index === frames.length - 1;
  return (
    <div className="scrubber" role="group" aria-label={t("radarTimeline")}>
      <button
        type="button"
        className="scrubber__play"
        onClick={onTogglePlay}
        aria-pressed={playing}
      >
        {playing ? t("pause") : t("play")}
      </button>
      <input
        className="scrubber__range"
        type="range"
        min={0}
        max={frames.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={t("radarFrame")}
        aria-valuetext={formatTime(current.validAt, lang)}
      />
      <span className="scrubber__time tnum">
        <span className="label">{t("radar")}</span> {formatTime(frames[0]!.validAt, lang)} –{" "}
        {formatTime(frames[frames.length - 1]!.validAt, lang)}
        {" · "}
        <strong>{formatTime(current.validAt, lang)}</strong>
        {isLatest ? <span className="label"> · {t("latest")}</span> : null}
      </span>
    </div>
  );
}
