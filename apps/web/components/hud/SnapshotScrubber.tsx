"use client";

import type { SnapshotMeta } from "@swiss-now/core/snapshot";
import { formatTime } from "@/lib/format";

export interface SnapshotScrubberProps {
  slots: SnapshotMeta[];
  index: number | null;
  playing: boolean;
  onChange: (index: number | null) => void;
  onTogglePlay: () => void;
}

/** The last 48 hours in 10-minute snapshots; the right end is live. */
export function SnapshotScrubber({
  slots,
  index,
  playing,
  onChange,
  onTogglePlay,
}: SnapshotScrubberProps) {
  if (slots.length < 2)
    return (
      <div className="scrubber scrubber--snapshots label">
        Not enough snapshots yet — they accumulate while the map is open.
      </div>
    );
  const last = slots.length - 1;
  const pos = index ?? last;
  const current = slots[pos]!;
  return (
    <div className="scrubber scrubber--snapshots" role="group" aria-label="Snapshot timeline">
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
        max={last}
        step={1}
        value={pos}
        onChange={(e) => {
          const i = Number(e.target.value);
          onChange(i === last ? null : i);
        }}
        aria-label="Snapshot"
        aria-valuetext={formatTime(current.at)}
      />
      <span className="scrubber__time tnum">
        <span className="label">Since</span> {formatTime(slots[0]!.at)} ·{" "}
        <strong>{index === null ? "now" : formatTime(current.at)}</strong>
        {index !== null ? <span className="label"> · snapshot</span> : null}
      </span>
    </div>
  );
}
