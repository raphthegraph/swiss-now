import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { VoteIndex, VoteResult, type PoliticsState } from "@swiss-now/core/state";
import { buildPoliticsState } from "@swiss-now/core/data-sources/politics";

/** Static data built by `build-data votes`: a local directory or a public base URL (Blob). */
const DATA_DIR = process.env["DATA_DIR"] ?? join(process.cwd(), "public", "data");
const DATA_URL = process.env["DATA_BASE_URL"]?.replace(/\/$/, "");
export const POLITICS_TTL_SECONDS = 3600;

async function readJson<T>(path: string, parse: (x: unknown) => T): Promise<T> {
  if (DATA_URL) {
    const res = await fetch(`${DATA_URL}/${path}`, { next: { revalidate: POLITICS_TTL_SECONDS } });
    if (!res.ok) throw new Error(`data ${res.status} ${path}`);
    return parse(await res.json());
  }
  return parse(JSON.parse(await readFile(join(DATA_DIR, path), "utf8")));
}

/** Politics: the index, the latest Sunday's results and the calendar. Rebuilt weekly by the data job. */
export async function getPoliticsState(now = new Date()): Promise<PoliticsState> {
  const index = await readJson("politics/index.json", (x) => VoteIndex.parse(x));
  const latestDate = index.votes[0]?.date;
  const latest = await Promise.all(
    index.votes
      .filter((v) => v.date === latestDate)
      .map((v) => readJson(`politics/votes/${v.id}.json`, (x) => VoteResult.parse(x))),
  );
  return buildPoliticsState(index, latest, now);
}
