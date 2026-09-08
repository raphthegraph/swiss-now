#!/usr/bin/env tsx
/**
 * Uploads a rail build to Vercel Blob (free tier) so deployments read the newest files.
 * Usage: BLOB_READ_WRITE_TOKEN=… tsx src/cli/upload-rail.ts --rail <dir> [--prefix rail]
 * Files are written at fixed pathnames (no random suffix) with a one-hour cache; path files are
 * immutable per build so the client cache keeps them longer.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { put } from "@vercel/blob";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".json")) out.push(p);
  }
  return out;
}

const main = async () => {
  const dir = arg("rail", join(process.cwd(), "out", "rail"));
  const prefix = arg("prefix", "rail");
  if (!process.env["BLOB_READ_WRITE_TOKEN"]) {
    console.log("[upload-rail] BLOB_READ_WRITE_TOKEN not set — skipping upload");
    return;
  }
  const files = walk(dir);
  console.log(`[upload-rail] uploading ${files.length} files from ${dir}`);
  let n = 0;
  const batch = 20;
  for (let i = 0; i < files.length; i += batch) {
    await Promise.all(
      files.slice(i, i + batch).map(async (f) => {
        const pathname = `${prefix}/${relative(dir, f).split("\\").join("/")}`;
        await put(pathname, readFileSync(f), {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
          cacheControlMaxAge: 3600,
        });
      }),
    );
    n += Math.min(batch, files.length - i);
    if (n % 500 === 0 || n === files.length) console.log(`[upload-rail] ${n}/${files.length}`);
  }
  console.log("[upload-rail] done");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
