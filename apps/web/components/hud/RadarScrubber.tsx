"use client";

import type { Field } from "@swiss-now/core";
import { formatTime } from "@/lib/format";

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
 * HUD; playback loops the sequence at 4 frames/s. GSAP takes over for the full multi-layer
 * timeline in Phase 3 (docs/MOTION_SYSTEM.md §3).
 */
export function RadarScrubber({
  frames,
  index,
  playing,
  onChange,
  onTogglePlay,
}: RadarScrubberProps) {
  if (frames.length < 2) return null;
  const current = frames[index] ?? frames[frames.length - 1]!;
  const isLatest = index === frames.length - 1;
  return (
    <div className="scrubber" role="group" aria-label="Precipitation radar timeline">
      <button
        type="button"
        className="scrubber__play"
        onClick={onTogglePlay}
        aria-pressed={playing}
      >
        {playing ? "Pause" : "Play"}
      </button>
      <input
        className="scrubber__range"
        type="range"
        min={0}
        max={frames.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Radar frame"
        aria-valuetext={formatTime(current.validAt)}
      />
      <span className="scrubber__time tnum">
        <span className="label">Radar</span> {formatTime(frames[0]!.validAt)} –{" "}
        {formatTime(frames[frames.length - 1]!.validAt)}
        {" · "}
        <strong>{formatTime(current.validAt)}</strong>
        {isLatest ? <span className="label"> · latest</span> : null}
      </span>
    </div>
  );
}
