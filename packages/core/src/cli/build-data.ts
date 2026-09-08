/**
 * Static data builds for the SWITZERLAND topics (docs/IA.md §2): fetched from the statistics
 * platforms, validated against the core schemas and written as JSON files that the web app reads
 * from `public/data/` in development or from Vercel Blob once deployed.
 *
 * Usage: tsx src/cli/build-data.ts votes [--out ../../apps/web/public/data] [--sundays 4] [--vintage 2026]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchVoteResult, listVotes } from "../data-sources/bfs-pxweb/votes";
import { SWISSVOTES_URL, enrichVoteMeta, parseSwissvotes } from "../data-sources/swissvotes/index";
import { fetchVoteDates } from "../data-sources/lindas/vote-dates";
import { VoteIndex, VoteResult, type VoteMeta } from "../state/politics";
import { IndicatorCatalog, IndicatorSeries } from "../state/stats";
import {
  buildJobs,
  buildKofBarometer,
  buildOvernightStays,
  buildPopulation,
  buildVacancy,
} from "../data-sources/stats/index";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv
    .slice(3)
    .map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] ?? "true"] : []))
    .filter((x) => x.length),
);
const command = process.argv[2];
const outDir = resolve(args["out"] ?? join(here, "../../../../apps/web/public/data"));
const log = (m: string) => console.log(`[build-data] ${m}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function write(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

async function votes() {
  const vintage = Number(args["vintage"] ?? new Date().getFullYear());
  const sundays = Number(args["sundays"] ?? 4);
  const now = new Date();
  log("listing votes from the BFS cube");
  const all = await listVotes();
  log(`${all.length} votes; newest ${all[0]?.date}`);
  log("reading swissvotes");
  const sv = new Map(
    parseSwissvotes(await (await fetch(SWISSVOTES_URL)).text()).map((r) => [r.id, r]),
  );
  const dates = await fetchVoteDates(`${vintage - 2}-01-01`);
  // the N most recent vote Sundays with results
  const recentDates = [...new Set(all.map((v) => v.date))].slice(0, sundays);
  const recent = all.filter((v) => recentDates.includes(v.date)).map((v) => enrichVoteMeta(v, sv));
  const metas: VoteMeta[] = [];
  for (const meta of recent) {
    const path = join(outDir, "politics", "votes", `${meta.id}.json`);
    log(`fetching ${meta.id} ${meta.date} ${meta.title.de.slice(0, 50)}`);
    const result = VoteResult.parse(await fetchVoteResult(meta, vintage, fetch, now));
    write(path, result);
    metas.push(meta);
    await sleep(400); // 50 calls per 15 s upstream
  }
  const index = VoteIndex.parse({
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    geoVintage: vintage,
    votes: metas,
    dates,
  });
  write(join(outDir, "politics", "index.json"), index);
  log(
    `${metas.length} votes over ${recentDates.length} Sundays → ${join(outDir, "politics")}; ${dates.length} calendar dates`,
  );
}

async function stats() {
  const vintage = Number(args["vintage"] ?? new Date().getFullYear());
  const now = new Date();
  const year = String(now.getFullYear());
  const builders: [string, () => Promise<import("../state/stats").IndicatorSeries>][] = [
    ["population", () => buildPopulation(now, vintage)],
    ["vacancy-rate", () => buildVacancy(now, vintage)],
    ["jobs-fte", () => buildJobs(now, vintage, String(now.getFullYear() - 2))],
    ["overnight-stays", () => buildOvernightStays(now, [String(now.getFullYear() - 1), year])],
    ["kof-barometer", () => buildKofBarometer(now)],
  ];
  const metas = [];
  for (const [id, build] of builders) {
    log(`building ${id}`);
    try {
      const s = IndicatorSeries.parse(await build());
      write(join(outDir, "stats", `${id}.json`), s);
      metas.push(s.meta);
      log(
        `  ${s.periods[0]} … ${s.periods[s.periods.length - 1]} · ${Object.keys(s.values).length} keys`,
      );
    } catch (e) {
      console.error(`[build-data] ${id} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(500);
  }
  write(
    join(outDir, "stats", "index.json"),
    IndicatorCatalog.parse({ schemaVersion: 1, generatedAt: now.toISOString(), indicators: metas }),
  );
  log(`${metas.length} indicators → ${join(outDir, "stats")}`);
}

switch (command) {
  case "votes":
    await votes();
    break;
  case "stats":
    await stats();
    break;
  default:
    console.error("usage: build-data votes|stats [--out dir] [--sundays 4] [--vintage 2026]");
    process.exit(1);
}
