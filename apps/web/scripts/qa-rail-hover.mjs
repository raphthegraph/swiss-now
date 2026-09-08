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
const seen404 = new Set();
page.on("response", (r) => {
  if (r.status() >= 400 && !seen404.has(r.url())) {
    seen404.add(r.url());
    console.log("http", r.status(), r.url().replace(base, ""));
  }
});
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

// AIR: reference stations on the index ramp, citizen sensors, pollen; hover card
await page.getByRole("button", { name: "Air" }).click();
await page.locator(".legend--ramp").waitFor({ timeout: 60_000 });
await page.waitForFunction(() => /air quality|citizen/i.test(document.querySelector(".strip")?.textContent ?? ""), null, { timeout: 60_000 });
await page.waitForTimeout(1500);
const airCounts = await page.evaluate(() => {
  const m = window.__swissNowMap;
  const feats = m.querySourceFeatures("air-stations");
  const ids = new Set(feats.map((f) => f.id));
  return { stations: ids.size, citizen: feats.filter((f) => f.properties.tier === "citizen").length, pollen: new Set(m.querySourceFeatures("pollen-stations").map((f) => f.id)).size };
});
const airStrip = await page.locator(".strip").innerText();
const airOk = airCounts.stations >= 5 && airCounts.pollen >= 5 && /air quality/i.test(airStrip);
console.log("air stations/citizen/pollen:", airCounts.stations, airCounts.citizen, airCounts.pollen, "| strip:", airStrip.replace(/\n/g, " | ").slice(0, 80), "| ok:", airOk);
await page.screenshot({ path: "/tmp/sn/qa-air.png" });

// HAZARDS: fire regions from the region route, snow stations, quakes; figures
await page.getByRole("button", { name: "Hazards" }).click();
await page.waitForFunction(() => /forest-fire|earthquake/i.test(document.querySelector(".strip")?.textContent ?? ""), null, { timeout: 60_000 });
await page.waitForFunction(() => { const m = window.__swissNowMap; return m && m.getSource("hazard-fire-regions") && m.querySourceFeatures("hazard-fire-regions").length > 10; }, null, { timeout: 60_000 });
const hazCounts = await page.evaluate(() => {
  const m = window.__swissNowMap;
  return { fire: new Set(m.querySourceFeatures("hazard-fire-regions").map((f) => f.id)).size, snow: new Set(m.querySourceFeatures("hazard-snow-stations").map((f) => f.id)).size, fireVisible: m.getLayoutProperty("hazard-fire-fill", "visibility") };
});
const hazStrip = await page.locator(".strip").innerText();
const hazardsOk = hazCounts.fire >= 10 && hazCounts.fireVisible === "visible" && /forest-fire/i.test(hazStrip);
console.log("hazards fire regions/snow:", hazCounts.fire, hazCounts.snow, hazCounts.fireVisible, "| strip:", hazStrip.replace(/\n/g, " | ").slice(0, 90), "| ok:", hazardsOk);
await page.screenshot({ path: "/tmp/sn/qa-hazards.png" });

// STATISTICS: population choropleth (quantile stops), charts, period timeline; tourism by canton
await page.getByRole("button", { name: "Population" }).click();
await page.locator(".legend--ramp").waitFor({ timeout: 60_000 });
await page.waitForFunction(
  () => {
    const m = window.__swissNowMap;
    if (!m || !m.getSource("stats-muni-municipalities")) return false;
    const fs = m.querySourceFeatures("stats-muni-municipalities");
    return fs.length > 100 && fs.some((f) => typeof m.getFeatureState({ source: "stats-muni-municipalities", id: f.id }).value === "number");
  },
  null,
  { timeout: 90_000 },
);
const popFilled = await page.evaluate(() => {
  const m = window.__swissNowMap;
  const seen = new Set();
  let n = 0;
  for (const f of m.querySourceFeatures("stats-muni-municipalities")) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    if (typeof m.getFeatureState({ source: "stats-muni-municipalities", id: f.id }).value === "number") n++;
  }
  return n;
});
const popStrip = await page.locator(".strip").innerText();
await page.locator("nav[aria-label='View'] .modes__item", { hasText: /^Charts$/i }).click();
await page.locator(".charts-view svg.plot").first().waitFor({ timeout: 30_000 });
const popChart = await page.locator(".charts-view svg.plot").count();
await page.locator("nav[aria-label='View'] .modes__item", { hasText: /^Timeline$/i }).click();
await page.locator(".scrubber--votes .scrubber__play").first().waitFor({ timeout: 20_000 });
await page.locator(".scrubber--votes .scrubber__play").first().click();
await page.waitForTimeout(600);
const popT = new URL(page.url()).searchParams.get("t");
await page.getByRole("button", { name: "Tourism" }).click();
await page.waitForFunction(
  () => {
    const m = window.__swissNowMap;
    if (
      !m ||
      !m.getSource("stats-canton-municipalities") ||
      m.getLayoutProperty("stats-canton-fill", "visibility") !== "visible"
    )
      return false;
    const fs = m.querySourceFeatures("stats-canton-municipalities");
    return fs.some(
      (f) => typeof m.getFeatureState({ source: "stats-canton-municipalities", id: f.id }).value === "number",
    );
  },
  null,
  { timeout: 60_000 },
);
const statsOk = popFilled > 1500 && /switzerland/i.test(popStrip) && popChart >= 1 && popT === "2024";
console.log("stats population filled:", popFilled, "| strip:", popStrip.replace(/\n/g, " | ").slice(0, 70), "| charts:", popChart, "| timeline t:", popT, "| ok:", statsOk);
await page.screenshot({ path: "/tmp/sn/qa-stats.png" });

// SNAPSHOT TIMELINE: NOW → TIMELINE shows the 48 h scrubber; stepping back writes the slot into the URL
await page.getByRole("button", { name: "Now" }).click();
await page.locator("nav[aria-label='View'] .modes__item", { hasText: /^Timeline$/i }).click();
await page.locator(".scrubber--snapshots").waitFor({ timeout: 30_000 });
await page.locator(".scrubber--snapshots input[type=range]").waitFor({ timeout: 30_000 });
await page.evaluate(() => {
  const r = document.querySelector(".scrubber--snapshots input[type=range]");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(r, "0");
  r.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForFunction(() => /snapshot/i.test(document.querySelector(".scrubber--snapshots")?.textContent ?? ""), null, { timeout: 30_000 });
await page.waitForTimeout(1200);
const snapT = new URL(page.url()).searchParams.get("t");
const snapStrip = await page.locator(".strip").innerText();
const snapshotOk = /^\d{8}T\d{4}$/.test(snapT ?? "") && /warmest/i.test(snapStrip) && /snapshot/i.test(await page.locator(".hud--top").innerText());
console.log("snapshot timeline t:", snapT, "| strip:", snapStrip.replace(/\n/g, " | ").slice(0, 60), "| ok:", snapshotOk);
await page.screenshot({ path: "/tmp/sn/qa-snapshot.png" });
await page.locator("nav[aria-label='View'] .modes__item", { hasText: /^Map$/i }).click();

// AVIATION stays gated: no rail entry, the route answers 451
const aviationButton = await page.getByRole("button", { name: "Aviation" }).count();
const aviationStatus = await page.evaluate(async () => (await fetch("/api/state/aviation")).status);
const aviationOk = aviationButton === 0 && aviationStatus === 451;
console.log("aviation gated: button", aviationButton, "| api", aviationStatus, "| ok:", aviationOk);

// COMPARE: two places via the URL, figures side by side (population)
await page.goto(`${base}/?topic=population&mode=compare&place=261,351`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.locator(".compare-view").waitFor({ timeout: 60_000 });
await page.waitForFunction(() => /Bern/.test(document.querySelector(".compare__table")?.textContent ?? ""), null, { timeout: 60_000 });
const compareText = (await page.locator(".compare__table").innerText()).replace(/\n/g, " | ");
const compareOk = /Zürich/.test(compareText) && /Bern/.test(compareText) && /Rank/i.test(compareText);
console.log("compare:", compareText.slice(0, 120), "| ok:", compareOk);
await page.screenshot({ path: "/tmp/sn/qa-compare.png" });
// keyboard: "]" moves to the next topic
await page.keyboard.press("]");
await page.waitForTimeout(500);
const keyTopic = new URL(page.url()).searchParams.get("topic");
console.log("keyboard ] →", keyTopic);
await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByRole("button", { name: "Politics" }).waitFor({ timeout: 60_000 });

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
  quakesOk = /earthquake|forest-fire/i.test(quakeStrip);
  console.log("strip in QUAKES:", quakeStrip.slice(0, 140), "| ok:", quakesOk);
  await page.screenshot({ path: "/tmp/sn/qa-quakes.png" });
} else console.log("QUAKES not in rail (no M≥2 event in window)");
// Stage 7: short viewport, keyboard help, mobile layout, tap-to-card, reduced motion
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto(`${base}/?topic=weather`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByRole("button", { name: "Rail" }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(600);
const railBox = await page.locator("nav[aria-label='Topics']").boundingBox();
const stripBox = await page.locator(".hud--bottom").boundingBox();
const shortOk = !!railBox && !!stripBox && railBox.y + railBox.height <= stripBox.y + 1;
console.log("short viewport: rail bottom", Math.round(railBox?.y + railBox?.height), "strip top", Math.round(stripBox?.y), "| ok:", shortOk);
await page.keyboard.press("?");
const helpOpen = (await page.locator("[role='dialog']").count()) === 1;
await page.keyboard.press("Escape");
const helpOk = helpOpen && (await page.locator("[role='dialog']").count()) === 0 && new URL(page.url()).searchParams.get("topic") === "weather";
console.log("keyboard help open/close keeps topic:", helpOk);
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/?topic=weather`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.getByRole("button", { name: "Rail" }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(800);
const railM = await page.locator("nav[aria-label='Topics']").boundingBox();
const stripM = await page.locator(".hud--bottom").boundingBox();
const metricsM = await page.locator(".metric--hud").evaluateAll((els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).display !== "none").length);
const mobileOk = !!railM && !!stripM && railM.height < 80 && railM.y + railM.height <= stripM.y + 1 && metricsM >= 3;
console.log("mobile: rail h", Math.round(railM?.height), "rail bottom", Math.round(railM?.y + railM?.height), "strip top", Math.round(stripM?.y), "figures", metricsM, "| ok:", mobileOk);
await page.waitForFunction(() => { const m = window.__swissNowMap; return m && m.loaded() && m.queryRenderedFeatures().some((f) => f.geometry.type === "Point" && f.layer.id === "weather-temp-circles"); }, null, { timeout: 60_000 });
const tapAt = await page.evaluate(() => { const m = window.__swissNowMap; const f = m.queryRenderedFeatures().find((x) => x.geometry.type === "Point" && x.layer.id === "weather-temp-circles"); const p = m.project(f.geometry.coordinates); return { x: p.x, y: p.y, layer: f.layer.id }; });
await page.mouse.click(tapAt.x, tapAt.y);
await page.waitForTimeout(300);
const tapOk = (await page.locator(".hover-card").count()) >= 1;
console.log("tap on", tapAt.layer, "opens a card:", tapOk);
// a tap on open water (no station there) must close the card; pick a lake that is on screen and clear of the HUD
const lake = await page.evaluate(({ top, bottom }) => {
  const m = window.__swissNowMap;
  for (const ll of [[6.55, 46.45], [6.85, 46.9], [9.4, 47.6], [8.55, 47.25], [8.3, 46.95]]) {
    const p = m.project(ll);
    if (p.x > 20 && p.x < innerWidth - 20 && p.y > top && p.y < bottom) return { x: p.x, y: p.y };
  }
  return null;
}, { top: 130, bottom: (stripM?.y ?? 600) - 60 });
if (lake) await page.mouse.click(lake.x, lake.y);
await page.waitForTimeout(300);
const tapCloseOk = (await page.locator(".hover-card").count()) === 0;
console.log("tap elsewhere closes it:", tapCloseOk);
// a phone context: touch events and a mobile user agent; the bottom HUD must leave the map usable
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const mp = await mctx.newPage();
await mp.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
await mp.getByRole("button", { name: "Rail" }).waitFor({ timeout: 60_000 });
await mp.waitForTimeout(800);
const railT = await mp.locator("nav[aria-label='Topics']").boundingBox();
const bottomShare = railT ? (844 - railT.y) / 844 : 1;
await mp.getByRole("button", { name: "Water" }).tap();
await mp.waitForFunction(() => new URL(location.href).searchParams.get("topic") === "water", null, { timeout: 10_000 }).catch(() => {});
const tTopic = new URL(mp.url()).searchParams.get("topic");
await mp.getByRole("button", { name: "Timeline" }).tap();
await mp.waitForFunction(() => new URL(location.href).searchParams.get("mode") === "timeline", null, { timeout: 10_000 }).catch(() => {});
const tMode = new URL(mp.url()).searchParams.get("mode");
await mp.locator(".sources-button").tap();
await mp.waitForTimeout(200);
const sheetItems = await mp.locator(".sheet__list li").count();
await mp.locator(".sheet__close").tap();
await mp.waitForTimeout(200);
const sheetClosed = (await mp.locator(".sheet").count()) === 0;
const homeHidden = await mp.locator(".hud--top .home").evaluate((el) => getComputedStyle(el).display === "none").catch(() => true);
await mp.screenshot({ path: "/tmp/sn/qa-phone.png" });
const touchOk = bottomShare <= 0.36 && tTopic === "water" && tMode === "timeline" && sheetItems >= 3 && sheetClosed && homeHidden;
console.log("phone: bottom HUD share", bottomShare.toFixed(2), "| tap topic", tTopic, "| tap mode", tMode, "| sources", sheetItems, "closed", sheetClosed, "| home hidden", homeHidden, "| ok:", touchOk);
await mctx.close();
await page.emulateMedia({ reducedMotion: "reduce" });
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Rail" }).waitFor({ timeout: 60_000 });
const reducedOk = await page.evaluate(() => { const d = getComputedStyle(document.querySelector(".rail__item")).transitionDuration; return d.endsWith("ms") ? parseFloat(d) <= 0.01 : parseFloat(d) <= 0.00001; });
console.log("reduced motion: chrome transitions off:", reducedOk);
await page.emulateMedia({ reducedMotion: "no-preference" });
await page.screenshot({ path: "/tmp/sn/qa-mobile.png" });
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
  eventsOk &&
  airOk &&
  hazardsOk &&
  statsOk &&
  snapshotOk &&
  compareOk &&
  keyTopic === "housing" &&
  aviationOk &&
  shortOk &&
  helpOk &&
  mobileOk &&
  tapOk &&
  tapCloseOk &&
  touchOk &&
  reducedOk
    ? 0
    : 1,
);
