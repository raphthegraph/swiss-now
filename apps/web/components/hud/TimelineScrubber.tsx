"use client";

import type { SnapshotMeta } from "@swiss-now/core/snapshot";
import { formatTime } from "@/lib/format";

export interface TimelineScrubberProps {
  snapshots: SnapshotMeta[];
  /** null = now */
  index: number | null;
  marks: { label: string; index: number }[];
  onChange: (index: number | null) => void;
}

/**
 * NOW ← 1h ← 3h ← 6h ← 12h ← TODAY. A hairline over the stored 10-minute snapshots; the right
 * end is live. Gaps in the list are real: on the free tier snapshots exist only while someone
 * was watching or a scheduled ping ran.
 */
export function TimelineScrubber({ snapshots, index, marks, onChange }: TimelineScrubberProps) {
  if (snapshots.length < 2) return null;
  const n = snapshots.length;
  const value = index === null ? n : index;
  const current = index === null ? undefined : snapshots[index];
  const first = snapshots[0]!;
  return (
    <div className="scrubber scrubber--timeline" role="group" aria-label="Timeline">
      <button
        type="button"
        className="scrubber__play"
        onClick={() => onChange(null)}
        aria-pressed={index === null}
      >
        Now
      </button>
      <div className="timeline__track">
        <input
          className="scrubber__range"
          type="range"
          min={0}
          max={n}
          step={1}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(v >= n ? null : v);
          }}
          aria-label="Time"
          aria-valuetext={current ? formatTime(current.at) : "now"}
        />
        <div className="timeline__marks" aria-hidden="true">
          {marks.map((m) => (
            <button
              key={m.label}
              type="button"
              className="timeline__mark label"
              style={{ left: `${(m.index / n) * 100}%` }}
              onClick={() => onChange(m.index)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <span className="scrubber__time tnum">
        <span className="label">Since</span> {formatTime(first.at)} ·{" "}
        <strong>{current ? formatTime(current.at) : "now"}</strong>
        {current ? <span className="label"> · snapshot</span> : null}
      </span>
    </div>
  );
}
