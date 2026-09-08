"use client";

import type { SnapshotMeta } from "@swiss-now/core/snapshot";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

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
  const { t, lang } = useT();
  if (slots.length < 2)
    return <div className="scrubber scrubber--snapshots label">{t("notEnoughSnapshots")}</div>;
  const last = slots.length - 1;
  const pos = index ?? last;
  const current = slots[pos]!;
  return (
    <div className="scrubber scrubber--snapshots" role="group" aria-label={t("snapshotTimeline")}>
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
        max={last}
        step={1}
        value={pos}
        onChange={(e) => {
          const i = Number(e.target.value);
          onChange(i === last ? null : i);
        }}
        aria-label={t("snapshot")}
        aria-valuetext={formatTime(current.at, lang)}
      />
      <span className="scrubber__time tnum">
        <span className="label">{t("since")}</span> {formatTime(slots[0]!.at, lang)} ·{" "}
        <strong>{index === null ? t("now") : formatTime(current.at, lang)}</strong>
        {index !== null ? <span className="label"> · {t("snapshot")}</span> : null}
      </span>
    </div>
  );
}
