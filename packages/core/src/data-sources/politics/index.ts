/** Politics assembly: the static files the data job writes and the state the API serves. */
import type { PoliticsState, VoteIndex, VoteResult } from "../../state/politics";
import { computeFreshness } from "../../freshness/index";

/** Builds the PoliticsState from the index and the latest Sunday's results. */
export function buildPoliticsState(
  index: VoteIndex,
  latest: VoteResult[],
  now = new Date(),
): PoliticsState {
  const latestDate = latest[0]?.meta.date ?? index.votes[0]?.date ?? "";
  const today = now.toISOString().slice(0, 10);
  const updatedAt = now.toISOString();
  return {
    schemaVersion: 1,
    updatedAt,
    observedAt: index.generatedAt,
    // the index is rebuilt weekly; a month without a rebuild reads as stale
    freshness: computeFreshness(index.generatedAt, 7 * 86_400, 0, now),
    sources: ["bfs-pxweb", "swissvotes", "lindas-politics"],
    latestDate,
    latest,
    index: index.votes,
    upcoming: index.dates.filter((d) => d.date >= today && d.type !== "blank"),
  };
}
