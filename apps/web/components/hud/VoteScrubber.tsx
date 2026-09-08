"use client";

import type { VoteMeta } from "@swiss-now/core";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

/**
 * Discrete timeline over recent votes (newest on the right). Same instrument shape as the radar
 * scrubber, so TIMELINE feels the same for live and statistics topics.
 */
export function VoteScrubber({
  votes,
  selectedId,
  onChange,
}: {
  votes: VoteMeta[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const { t, l, lang } = useT();
  if (votes.length < 2) return null;
  const ordered = [...votes].reverse(); // oldest → newest
  const index = Math.max(
    0,
    ordered.findIndex((v) => v.id === selectedId),
  );
  const current = ordered[index]!;
  return (
    <div className="scrubber scrubber--votes" role="group" aria-label={t("voteTimeline")}>
      <button
        type="button"
        className="scrubber__play"
        onClick={() => onChange(ordered[Math.max(0, index - 1)]!.id)}
        disabled={index === 0}
        aria-label={t("previousVote")}
      >
        ←
      </button>
      <input
        className="scrubber__range"
        type="range"
        min={0}
        max={ordered.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(ordered[Number(e.target.value)]!.id)}
        aria-label={t("vote")}
        aria-valuetext={`${current.date} ${l(current.title)}`}
      />
      <span className="scrubber__time">
        <span className="label tnum">{formatDate(current.date, lang)}</span> {l(current.title)}
      </span>
    </div>
  );
}
