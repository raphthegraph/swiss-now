/**
 * Builds today's StorySpec from the local snapshot files without a running server:
 *   node_modules/.bin/tsx apps/web/scripts/story-from-snapshots.ts [YYYY-MM-DD] > story.json
 * Same builder as /api/story/today; used to refresh the video fixture after story-contract changes.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Snapshot } from "@swiss-now/core/snapshot";
import { buildStory } from "@swiss-now/core/story";

const dir = join(process.cwd(), "apps/web/public/snapshots");
const date =
  process.argv[2] ??
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
const prefix = date.replaceAll("-", "");
const snapshots = readdirSync(dir)
  .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
  // same as the web store: files are our own writes, read without re-validation
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Snapshot);
process.stdout.write(
  JSON.stringify(buildStory(snapshots, { date, now: new Date() }), null, 2) + "\n",
);
