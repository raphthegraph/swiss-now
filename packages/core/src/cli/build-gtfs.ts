#!/usr/bin/env tsx
/**
 * Mode 2 job: GTFS static → rail files (docs/ARCHITECTURE.md §2.2).
 * Usage: tsx src/cli/build-gtfs.ts [--zip path] [--out dir] [--days 7]
 * Without --zip the newest archive is downloaded via the platform permalink (≈ 248 MB).
 */
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  BROWSER_UA,
  GTFS_PERMALINK,
  buildRailFromGtfs,
  serviceWindow,
} from "../data-sources/transit/build";
import {
  toDayFile,
  toPatternsFile,
  toRoutesFile,
  toStopsFile,
  type RailMeta,
} from "../data-sources/transit/rail-files";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

async function download(to: string): Promise<void> {
  const res = await fetch(GTFS_PERMALINK, {
    headers: { "User-Agent": BROWSER_UA },
    redirect: "follow",
  });
  if (!res.ok || !res.body) throw new Error(`GTFS download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(to));
}

const main = async () => {
  const out = arg("out", join(process.cwd(), "out", "rail"));
  const days = Number(arg("days", "7"));
  let zipPath = arg("zip", "");
  const log = (m: string) => console.log(`[build-gtfs] ${m}`);
  mkdirSync(out, { recursive: true });
  if (!zipPath) {
    zipPath = join(out, "gtfs.zip");
    log(`downloading ${GTFS_PERMALINK} → ${zipPath}`);
    await download(zipPath);
  }
  const now = new Date();
  const build = await buildRailFromGtfs({ zipPath, now, days, log });
  const builtAt = now.toISOString();
  const window = serviceWindow(now, days);

  writeFileSync(join(out, "stops.json"), JSON.stringify(toStopsFile(build)));
  writeFileSync(join(out, "routes.json"), JSON.stringify(toRoutesFile(build)));
  writeFileSync(join(out, "patterns.json"), JSON.stringify(toPatternsFile(build)));
  mkdirSync(join(out, "days"), { recursive: true });
  for (const day of window) {
    const file = toDayFile(build, day, builtAt);
    writeFileSync(join(out, "days", `${day}.json`), JSON.stringify(file));
    log(`day ${day}: ${file.trips.length} trips`);
  }
  const meta: RailMeta = {
    schemaVersion: 1,
    feedVersion: build.feedVersion,
    feedStart: build.feedStart,
    feedEnd: build.feedEnd,
    builtAt,
    days: window,
    counts: {
      routes: build.routes.size,
      stops: build.stops.size,
      patterns: build.patterns.size,
      trips: build.trips.size,
    },
  };
  writeFileSync(join(out, "meta.json"), JSON.stringify(meta, null, 1));
  log(`done → ${out}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
