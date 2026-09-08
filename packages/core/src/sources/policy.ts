/**
 * Licence policy: which sources may render. The owner's rule (2026-09-08) is "commercially clean
 * only": sources whose terms forbid commercial use or require asking are blocked; sources whose
 * terms could not be verified render with a visible notice until confirmed (docs/IA.md §7).
 */
import { SOURCES } from "./registry";
import type { SourceId } from "./ids";

export type SourceAccess = "allowed" | "notice" | "blocked";

export interface PolicyOptions {
  /** Block "unresolved" sources too (set SWISS_NOW_STRICT=1). */
  strict?: boolean;
  /** Local override for blocked sources (SWISS_NOW_ALLOW=adsb-fi,…); never set in production. */
  allow?: SourceId[];
}

export function sourceAccess(id: SourceId, opts: PolicyOptions = {}): SourceAccess {
  const meta = SOURCES[id];
  if (opts.allow?.includes(id)) return "notice";
  switch (meta.commercialUse) {
    case "yes":
      return "allowed";
    case "unresolved":
      return opts.strict ? "blocked" : "notice";
    default:
      return "blocked";
  }
}

export function isSourceAllowed(id: SourceId, opts?: PolicyOptions): boolean {
  return sourceAccess(id, opts) !== "blocked";
}

/** Access for a set of sources: blocked if any is blocked, notice if any needs one. */
export function accessForSources(ids: SourceId[], opts?: PolicyOptions): SourceAccess {
  let out: SourceAccess = "allowed";
  for (const id of ids) {
    const a = sourceAccess(id, opts);
    if (a === "blocked") return "blocked";
    if (a === "notice") out = "notice";
  }
  return out;
}

export function policyFromEnv(env: Record<string, string | undefined> = {}): PolicyOptions {
  const allow = (env["SWISS_NOW_ALLOW"] ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x): x is SourceId => x.length > 0 && x in SOURCES);
  return { strict: env["SWISS_NOW_STRICT"] === "1", ...(allow.length ? { allow } : {}) };
}
