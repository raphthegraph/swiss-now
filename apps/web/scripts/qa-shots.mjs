/**
 * Screenshots of the main views for a visual check (docs/DESIGN.md). Usage:
 * node scripts/qa-shots.mjs [baseUrl] → /tmp/sn/shot-*.png
 */
import { chromium } from "playwright-core";
import { readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const base = process.argv[2] ?? "http://localhost:3100";
const cache = join(homedir(), "Library", "Caches", "ms-playwright");
const builds = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort() : [];
const exe = builds.length ? join(cache, builds[builds.length - 1], "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing") : undefined;
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const shots = [
  ["desktop-now", { width: 1440, height: 900 }, "/?lang=de"],
  ["desktop-weather-timeline", { width: 1440, height: 900 }, "/?topic=weather&mode=timeline&lang=de"],
  ["desktop-population-charts", { width: 1440, height: 900 }, "/?topic=population&mode=charts&lang=de"],
  ["desktop-today", { width: 1440, height: 900 }, "/today?lang=de"],
  ["desktop-status", { width: 1440, height: 900 }, "/status"],
  ["phone-now", { width: 390, height: 844 }, "/?lang=de"],
  ["phone-weather", { width: 390, height: 844 }, "/?topic=weather&lang=de"],
];
for (const [name, viewport, path] of shots) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(viewport.width < 768 ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(name, "pageerror:", e.message));
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  if (!/status/.test(path))
    await page.waitForFunction(() => { const m = window.__swissNowMap; return m && m.loaded(); }, null, { timeout: 45_000 }).catch(() => console.log(name, "map still loading (radar tiles); shot taken anyway"));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/sn/shot-${name}.png` });
  console.log("shot", name);
  await ctx.close();
}
await browser.close();
