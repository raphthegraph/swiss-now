#!/usr/bin/env node
/**
 * QA: does hovering a train open the card? Runs Chromium headless with software WebGL so MapLibre
 * renders. Usage: node scripts/qa-rail-hover.mjs [baseUrl] (default http://localhost:3100)
 */
import { chromium } from "playwright-core";
import { readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const cache = join(homedir(), "Library", "Caches", "ms-playwright");
const builds = existsSync(cache)
  ? readdirSync(cache)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort()
  : [];
const exe = builds.length
  ? join(
      cache,
      builds[builds.length - 1],
      "chrome-mac-arm64",
      "Google Chrome for Testing.app",
      "Contents",
      "MacOS",
      "Google Chrome for Testing",
    )
  : undefined;

const browser = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text()));
await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByRole("button", { name: "Rail" }).waitFor({ timeout: 90_000 });
const webgl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
console.log("webgl2:", webgl, "canvas:", await page.locator("canvas.maplibregl-canvas").count());
await page.getByRole("button", { name: "Rail" }).click();
await page.waitForFunction(
  () => Array.isArray(window.__swissNowTrains) && window.__swissNowTrains.length > 50,
  null,
  { timeout: 60_000 },
);
const trains = await page.evaluate(() => window.__swissNowTrains);
console.log(
  "drawn trains:",
  trains.length,
  "delayed:",
  trains.filter((t) => t.delay >= 180).length,
);
const target = trains.find((t) => t.x > 300 && t.x < 1100 && t.y > 150 && t.y < 700) ?? trains[0];
console.log("hovering", target);
await page.mouse.move(target.x, target.y, { steps: 4 });
await page.waitForTimeout(400);
const card = page.locator(".hover-card--rail");
const shown = (await card.count()) > 0;
console.log(
  "hover card shown:",
  shown,
  shown ? (await card.first().innerText()).replace(/\n/g, " | ") : "",
);
const stripText = (await page.locator(".strip").innerText()).replace(/\n/g, " | ");
console.log("strip in RAIL:", stripText.slice(0, 160));
const railFigures = /Trains running/i.test(stripText);
const legend = await page.locator(".legend").count();
const scrubber = await page.locator(".scrubber").count();
console.log(
  "legend visible:",
  legend > 0,
  "scrubber visible in RAIL (should be false):",
  scrubber > 0,
);
await page.screenshot({ path: "/tmp/sn/qa-rail.png" });
// QUAKES view (present only when a magnitude ≥ 2 event is in the window)
const quakesButton = page.getByRole("button", { name: "Quakes" });
let quakesOk = true;
if ((await quakesButton.count()) > 0) {
  await quakesButton.click();
  await page.waitForTimeout(800);
  const quakeStrip = (await page.locator(".strip").innerText()).replace(/\n/g, " | ");
  quakesOk = /Last earthquake/i.test(quakeStrip);
  console.log("strip in QUAKES:", quakeStrip.slice(0, 140), "| ok:", quakesOk);
  await page.screenshot({ path: "/tmp/sn/qa-quakes.png" });
} else console.log("QUAKES not in rail (no M≥2 event in window)");
await browser.close();
process.exit(shown && railFigures && quakesOk ? 0 : 1);
