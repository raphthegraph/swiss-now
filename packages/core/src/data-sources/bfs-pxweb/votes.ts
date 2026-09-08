/**
 * Federal vote results per municipality from the BFS cube `px-x-1703030000_101`
 * ("Volksabstimmungen, Ergebnisse Ebene Gemeinde", DE only; OPEN BY). Geo codes: `CH`, canton
 * codes, 6-digit district codes and zero-padded 4-digit BFS municipality numbers.
 */
import type { VoteMeta, VoteResult, VoteShare } from "../../state/politics";
import { CantonCode } from "../../state/common";
import {
  categoryCodes,
  pxwebMeta,
  pxwebQuery,
  valueAt,
  type FetchLike,
  type JsonStat2,
} from "./client";

export const VOTES_CUBE = "px-x-1703030000_101";
const GEO = "Kanton (-) / Bezirk (>>) / Gemeinde (......)";
const VOTE = "Datum und Vorlage";
const RESULT = "Ergebnis";
const RESULT_TURNOUT = "3";
const RESULT_YES = "7";

/** `2026-06-14 Änderung des …` → date + title. */
export function splitVoteLabel(label: string): { date: string; title: string } {
  const m = /^(\d{4}-\d{2}-\d{2})\s+(.*)$/.exec(label.trim());
  return m ? { date: m[1]!, title: m[2]! } : { date: "", title: label };
}

/** Votes in the cube, newest first, from its metadata. */
export async function listVotes(fetchFn: FetchLike = fetch): Promise<VoteMeta[]> {
  const meta = await pxwebMeta(VOTES_CUBE, "de", fetchFn);
  const v = meta.variables.find((x) => x.code === VOTE);
  if (!v) throw new Error("pxweb votes: no vote dimension");
  return v.values
    .map((id, i) => {
      const { date, title } = splitVoteLabel(v.valueTexts[i] ?? "");
      return { id, date, title: { de: title } } satisfies VoteMeta;
    })
    .filter((x) => x.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
}

/** Parses one vote's JSON-stat2 payload (turnout and yes-% for every geo unit). */
export function parseVoteResult(
  d: JsonStat2,
  meta: VoteMeta,
  geoVintage: number,
  updatedAt: string,
): VoteResult {
  const geo = categoryCodes(d, GEO);
  const results = categoryCodes(d, RESULT);
  const votes = categoryCodes(d, VOTE);
  const gi = d.id.indexOf(GEO);
  const vi = d.id.indexOf(VOTE);
  const ri = d.id.indexOf(RESULT);
  const voteIndex = votes.indexOf(meta.id);
  if (voteIndex < 0) throw new Error(`pxweb votes: vote ${meta.id} not in payload`);
  const tI = results.indexOf(RESULT_TURNOUT);
  const yI = results.indexOf(RESULT_YES);
  const at = (g: number, r: number): number | null => {
    if (r < 0) return null;
    const pos: number[] = [];
    pos[gi] = g;
    pos[vi] = voteIndex;
    pos[ri] = r;
    return valueAt(d, pos);
  };
  const share = (g: number): VoteShare => ({ yesPct: at(g, yI), turnoutPct: at(g, tI) });
  let national: VoteShare = { yesPct: null, turnoutPct: null };
  const byCanton: VoteResult["byCanton"] = {};
  const byMunicipality: Record<string, VoteShare> = {};
  geo.forEach((code, g) => {
    if (code === "CH") national = share(g);
    else if (/^[A-Z]{2}$/.test(code)) {
      const c = CantonCode.safeParse(code);
      if (c.success) byCanton[c.data] = share(g);
    } else if (/^\d{4}$/.test(code)) {
      const s = share(g);
      if (s.yesPct !== null) byMunicipality[String(Number(code))] = s;
    }
    // 6-digit district codes are skipped: districts come from the geo spine
  });
  return {
    schemaVersion: 1,
    meta,
    status: national.yesPct === null ? "pending" : "final",
    national,
    byCanton,
    byMunicipality,
    geoVintage,
    source: "bfs-pxweb",
    updatedAt,
  };
}

export async function fetchVoteResult(
  meta: VoteMeta,
  geoVintage: number,
  fetchFn: FetchLike = fetch,
  now = new Date(),
): Promise<VoteResult> {
  const d = await pxwebQuery(
    VOTES_CUBE,
    "de",
    [
      { code: GEO, selection: { filter: "all", values: ["*"] } },
      { code: VOTE, selection: { filter: "item", values: [meta.id] } },
      { code: RESULT, selection: { filter: "item", values: [RESULT_TURNOUT, RESULT_YES] } },
    ],
    fetchFn,
  );
  return parseVoteResult(d, meta, geoVintage, now.toISOString());
}
