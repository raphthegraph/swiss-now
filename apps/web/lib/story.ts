import { buildStory } from "@swiss-now/core/story";
import type { Snapshot, StorySpec } from "@swiss-now/core";
import { snapshotStore } from "@/lib/snapshots/store";
import { maybeWriteSnapshot } from "@/lib/snapshots/writer";

/** Local date in Switzerland, `YYYY-MM-DD`. */
export function swissDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Today's story from today's snapshots (writing the current one first so the story is never empty). */
export async function getTodayStory(now = new Date()): Promise<StorySpec> {
  await maybeWriteSnapshot(now).catch(() => undefined);
  const store = snapshotStore();
  const date = swissDate(now);
  const dayStart = new Date(`${date}T00:00:00+02:00`).getTime() - 3_600_000; // generous: covers CET/CEST
  const metas = await store.list(dayStart);
  const snapshots: Snapshot[] = [];
  for (const m of metas.filter((x) => swissDate(new Date(x.at)) === date)) {
    const id = m.url
      .split("/")
      .pop()!
      .replace(/\.json$/, "");
    const s = await store.read(id);
    if (s) snapshots.push(s);
  }
  return buildStory(snapshots, { date, now });
}
