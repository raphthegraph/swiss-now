/**
 * swissvotes.ch dataset (CC BY 4.0): titles in DE/FR/EN, legal form, Federal Council position and
 * national results for every federal vote. Joins the BFS cube by vote number (`anr` × 10).
 * The CSV is `;`-separated with a UTF-8 BOM and ~870 columns; we read a handful.
 */
import { parse } from "csv-parse/sync";
import type { LocalizedText } from "../../state/common";
import type { VoteKind, VoteMeta } from "../../state/politics";

export const SWISSVOTES_URL = "https://swissvotes.ch/page/dataset/swissvotes_dataset.csv";

export interface SwissvotesRow {
  anr: number;
  /** BFS cube id: anr × 10 (682.1 → 6821). */
  id: string;
  date: string;
  title: LocalizedText;
  kind: VoteKind | undefined;
  councilRecommendation: "yes" | "no" | "none" | undefined;
  national: {
    yesPct: number | null;
    turnoutPct: number | null;
    accepted?: boolean;
    cantonsYes?: number;
    cantonsNo?: number;
  };
}

const KIND: Record<string, VoteKind> = {
  "1": "mandatory-referendum",
  "2": "optional-referendum",
  "3": "initiative",
  "4": "counter-proposal",
  "5": "tie-break",
};

const num = (s: string | undefined): number | null => {
  if (s === undefined || s === "" || s === ".") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** `14.06.2026` → `2026-06-14`. */
export function swissvotesDate(s: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

export function parseSwissvotes(csv: string): SwissvotesRow[] {
  const rows = parse(csv.replace(/^﻿/, ""), {
    delimiter: ";",
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  return rows
    .map((r): SwissvotesRow | undefined => {
      const anr = Number(r["anr"]);
      if (!Number.isFinite(anr)) return undefined;
      const title: LocalizedText = { de: r["titel_kurz_d"] ?? "" };
      if (r["titel_kurz_f"]) title.fr = r["titel_kurz_f"];
      if (r["titel_kurz_e"]) title.en = r["titel_kurz_e"];
      const br = r["br-pos"];
      const national: SwissvotesRow["national"] = {
        yesPct: num(r["volkja-proz"]),
        turnoutPct: num(r["bet"]),
      };
      const accepted = r["annahme"];
      if (accepted === "1" || accepted === "0") national.accepted = accepted === "1";
      const ky = num(r["kt-ja"]);
      const kn = num(r["kt-nein"]);
      if (ky !== null) national.cantonsYes = ky;
      if (kn !== null) national.cantonsNo = kn;
      return {
        anr,
        id: String(Math.round(anr * 10)),
        date: swissvotesDate(r["datum"] ?? ""),
        title,
        kind: KIND[r["rechtsform"] ?? ""],
        councilRecommendation:
          br === "1" ? "yes" : br === "2" ? "no" : br === "3" || br === "8" ? "none" : undefined,
        national,
      };
    })
    .filter((x): x is SwissvotesRow => x !== undefined);
}

/** Enriches a cube vote with swissvotes titles and national figures when the ids match. */
export function enrichVoteMeta(meta: VoteMeta, rows: Map<string, SwissvotesRow>): VoteMeta {
  const r = rows.get(meta.id);
  if (!r) return meta;
  const out: VoteMeta = {
    ...meta,
    anr: r.anr,
    title: {
      ...meta.title,
      ...(r.title.fr ? { fr: r.title.fr } : {}),
      ...(r.title.en ? { en: r.title.en } : {}),
    },
  };
  if (r.kind) out.kind = r.kind;
  if (r.councilRecommendation) out.councilRecommendation = r.councilRecommendation;
  out.national = r.national;
  return out;
}
