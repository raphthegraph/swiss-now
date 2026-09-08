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
// IA: topics rail with groups, mode switcher, view state in the URL
const railGroups = await page.locator("nav[aria-label='Topics'] .rail__group").allInnerTexts();
const modeCount = await page.locator("nav[aria-label='View'] .modes__item").count();
console.log("rail groups:", railGroups.join("/"), "| modes:", modeCount);
const webgl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
console.log("webgl2:", webgl, "canvas:", await page.locator("canvas.maplibregl-canvas").count());
await page.getByRole("button", { name: "Rail" }).click();
const railUrl = new URL(page.url()).searchParams.get("topic") === "rail";
console.log("url topic=rail:", railUrl);
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
// WEATHER: the radar scrubber is the TIMELINE instrument, absent in MAP
await page.getByRole("button", { name: "Weather" }).click();
await page.waitForTimeout(500);
const scrubMap = await page.locator(".scrubber").count();
await page.locator("nav[aria-label='View'] .modes__item", { hasText: /^Timeline$/i }).click();
await page.waitForTimeout(800);
const scrubTimeline = await page.locator(".scrubber").count();
const modeUrl = new URL(page.url()).searchParams.get("mode") === "timeline";
const timelineOk = scrubMap === 0 && scrubTimeline === 1 && modeUrl;
console.log("weather scrubber map/timeline:", scrubMap, scrubTimeline, "| url mode:", modeUrl, "| ok:", timelineOk);
// ENERGY: border-flow arrows on the canvas, figures, CHARTS mode with an SVG plot
await page.getByRole("button", { name: "Energy" }).click();
await page.waitForFunction(() => /net (import|export)/i.test(document.querySelector(".strip")?.textContent ?? ""), null, { timeout: 60_000 });
const energyApi = await page.evaluate(async () => {
  const r = await fetch("/api/state/energy");
  const j = await r.json();
  return { status: r.status, flows: Object.keys(j.borderFlows ?? {}).length, hz: j.frequencyHz, price: j.price?.eurPerMWh, series: j.generationSeries?.unixSeconds?.length };
});
const flowCanvas = await page.locator(".flow-canvas").count();
await page.locator("nav[aria-label='View'] .modes__item", { hasText: /^Charts$/i }).click();
await page.locator(".charts-view svg.plot").waitFor({ timeout: 30_000 });
const chartOk = (await page.locator(".charts-view svg.plot").count()) === 1;
const energyOk = energyApi.status === 200 && energyApi.flows === 4 && flowCanvas === 1 && chartOk;
console.log("energy api:", JSON.stringify(energyApi), "| flow canvas:", flowCanvas, "| chart:", chartOk, "| ok:", energyOk);
await page.screenshot({ path: "/tmp/sn/qa-energy-charts.png" });
await page.locator("nav[aria-label='View'] .modes__item", { hasText: /^Map$/i }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/sn/qa-energy.png" });

// EVENTS: geocoded markers with confidence
await page.getByRole("button", { name: "Events" }).click();
await page.locator(".event-marker").first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(800);
const markerCount = await page.locator(".event-marker").count();
const confident = await page.locator(".event-marker[data-confidence='0.95']").count();
const markerXs = await page.evaluate(() =>
  new Set([...document.querySelectorAll(".event-marker")].map((el) => Math.round(el.getBoundingClientRect().left / 20))).size,
);
const eventsStrip = await page.locator(".strip").innerText();
const eventsOk = markerCount >= 5 && confident >= 1 && markerXs >= 5 && /events/i.test(eventsStrip);
console.log("event markers:", markerCount, "| distinct x:", markerXs, "| confidence 0.95:", confident, "| strip:", eventsStrip.replace(/\n/g, " | ").slice(0, 80), "| ok:", eventsOk);
await page.screenshot({ path: "/tmp/sn/qa-events.png" });

// POLITICS: choropleth from the geo spine with feature-state values, hover card, vote timeline
await page.getByRole("button", { name: "Politics" }).click();
await page.locator(".legend--ramp").waitFor({ timeout: 60_000 });
await page.waitForFunction(
  () => {
    const m = window.__swissNowMap;
    return (
      m &&
      m.getSource("politics-municipalities") &&
      m.querySourceFeatures("politics-municipalities").length > 100
    );
  },
  null,
  { timeout: 90_000 },
);
await page.waitForTimeout(1500);
const filled = await page.evaluate(() => {
  const m = window.__swissNowMap;
  const seen = new Set();
  let n = 0;
  for (const f of m.querySourceFeatures("politics-municipalities")) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const st = m.getFeatureState({ source: "politics-municipalities", id: f.id });
    if (st && typeof st.value === "number") n++;
  }
  return { features: seen.size, filled: n };
});
const stripPolitics = await page.locator(".strip").innerText();
const bern = await page.evaluate(() => {
  const p = window.__swissNowMap.project([7.44, 46.95]);
  return { x: p.x, y: p.y };
});
await page.mouse.move(bern.x, bern.y);
await page.waitForTimeout(500);
const voteCard = await page.locator(".hover-card--vote").count();
const cardText = voteCard ? await page.locator(".hover-card--vote").innerText() : "";
await page.locator("nav[aria-label='View'] .modes__item", { hasText: /^Timeline$/i }).click();
await page.locator(".scrubber--votes").waitFor({ timeout: 20_000 });
await page.locator(".scrubber--votes .scrubber__play").first().click();
await page.waitForTimeout(800);
const tParam = new URL(page.url()).searchParams.get("t");
const politicsOk = filled.filled > 100 && /yes/i.test(stripPolitics) && voteCard === 1 && !!tParam;
console.log(
  "politics features/filled:",
  filled.features,
  filled.filled,
  "| strip:",
  stripPolitics.replace(/\n/g, " | ").slice(0, 90),
  "| hover:",
  cardText.replace(/\n/g, " | ").slice(0, 80),
  "| timeline t:",
  tParam,
  "| ok:",
  politicsOk,
);
await page.screenshot({ path: "/tmp/sn/qa-politics.png" });

// deep link
await page.goto(`${base}/?topic=water`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByRole("button", { name: "Water" }).waitFor({ timeout: 60_000 });
const waterCurrent = (await page.getByRole("button", { name: "Water" }).getAttribute("aria-current")) === "true";
console.log("deep link topic=water current:", waterCurrent);

// Today story: chapters render and the first headline is real
await page.goto(`${base}/today`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.locator(".chapter__headline").first().waitFor({ timeout: 60_000 });
const chapters = await page.locator(".chapter__headline").count();
const firstHeadline = await page.locator(".chapter__headline").first().innerText();
const todayOk = chapters >= 1 && firstHeadline.length > 10;
console.log("today chapters:", chapters, "|", firstHeadline.slice(0, 80), "| ok:", todayOk);
await page.screenshot({ path: "/tmp/sn/qa-today.png" });

// Today video: the poster mounts the Remotion Player, whose map plate must come up
let playerOk = false;
const poster = await page.$(".video-poster");
if (poster) {
  await poster.scrollIntoViewIfNeeded();
  await poster.click();
  await page
    .waitForSelector(".video-frame canvas.maplibregl-canvas", { timeout: 90_000 })
    .then(() => (playerOk = true))
    .catch(() => {});
}
console.log("today player mounted:", playerOk);
await page.screenshot({ path: "/tmp/sn/qa-today-player.png" });
await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByRole("button", { name: "Rail" }).waitFor({ timeout: 90_000 });
// QUAKES view (present only when a magnitude ≥ 2 event is in the window)
const quakesButton = page.getByRole("button", { name: "Hazards" });
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
process.exit(
  shown &&
  railFigures &&
  quakesOk &&
  todayOk &&
  playerOk &&
  railUrl &&
  timelineOk &&
  waterCurrent &&
  politicsOk &&
  energyOk &&
  eventsOk
    ? 0
    : 1,
);
