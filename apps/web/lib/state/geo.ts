import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GeoRegister } from "@swiss-now/core/state";

const GEO_DIR = process.env["GEO_DIR"] ?? join(process.cwd(), "public", "geo");
let registerPromise: Promise<GeoRegister> | undefined;

/** The municipality register (names, cantons, centroids) read once per instance. */
export function getRegister(): Promise<GeoRegister> {
  registerPromise ??= readFile(join(GEO_DIR, "municipalities-2026.json"), "utf8").then((s) =>
    GeoRegister.parse(JSON.parse(s)),
  );
  return registerPromise;
}
