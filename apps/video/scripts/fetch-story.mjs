#!/usr/bin/env node
/**
 * Saves a StorySpec as a fixture: `node scripts/fetch-story.mjs [url] [out]`.
 * Default url: http://localhost:3100/api/story/today (the web app), default out: fixtures/story-<date>.json.
 * Fixtures make renders deterministic and archive the day's story next to the video.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3100/api/story/today";
const res = await fetch(url, { headers: { accept: "application/json" } });
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${url}`);
  process.exit(1);
}
const story = await res.json();
if (!story?.date || !Array.isArray(story.chapters)) {
  console.error("not a StorySpec");
  process.exit(1);
}
const out = process.argv[3] ?? join("fixtures", `story-${story.date}.json`);
mkdirSync(join(out, ".."), { recursive: true });
writeFileSync(out, JSON.stringify(story, null, 2) + "\n");
console.log(`${out}: ${story.chapters.length} chapters (${story.chapters.map((c) => c.type).join(", ")})`);
