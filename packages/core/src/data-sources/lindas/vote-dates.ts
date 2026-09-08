/**
 * Vote Sundays from the Federal Chancellery cube on LINDAS
 * (`political-rights/popular-vote/voting_dates/1`): used dates with their number of proposals,
 * scheduled ones, reserved blanks and National Council election days.
 */
import type { VoteDate } from "../../state/politics";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const LINDAS_ENDPOINT = "https://ld.admin.ch/query";
const CUBE = "https://politics.ld.admin.ch/political-rights/popular-vote/voting_dates/1";

const TYPE: Record<string, VoteDate["type"]> = {
  genutzt: "used",
  festgelegt: "scheduled",
  blanko: "blank",
  nationalratswahlen: "elections",
};

export function voteDatesQuery(from: string): string {
  return `PREFIX cube: <https://cube.link/>
PREFIX vd: <https://politics.ld.admin.ch/political-rights/popular-vote/voting_dates/>
SELECT ?date ?n ?typ WHERE {
  <${CUBE}> cube:observationSet ?set . ?set cube:observation ?obs .
  ?obs vd:date ?date ; vd:vorlagen ?n ; vd:typ ?typ .
  FILTER(STR(?date) >= "${from}")
} ORDER BY ?date LIMIT 40`;
}

interface SparqlJson {
  results: { bindings: Record<string, { value: string }>[] };
}

export function parseVoteDates(json: SparqlJson): VoteDate[] {
  return json.results.bindings.map((b) => {
    const n = Number(b["n"]?.value);
    const type = TYPE[b["typ"]?.value.split("/").pop() ?? ""] ?? "blank";
    const out: VoteDate = { date: b["date"]!.value.slice(0, 10), type };
    if (Number.isFinite(n)) out.proposals = n;
    return out;
  });
}

export async function fetchVoteDates(
  from: string,
  fetchFn: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<VoteDate[]> {
  const res = await fetchFn(LINDAS_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/sparql-results+json",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": SWISS_NOW_USER_AGENT,
    },
    body: `query=${encodeURIComponent(voteDatesQuery(from))}`,
  });
  if (!res.ok) throw new Error(`lindas ${res.status}`);
  return parseVoteDates((await res.json()) as SparqlJson);
}
