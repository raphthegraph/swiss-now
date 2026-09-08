import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseVoteResult, splitVoteLabel } from "../src/data-sources/bfs-pxweb/votes";
import type { JsonStat2 } from "../src/data-sources/bfs-pxweb/client";
import {
  enrichVoteMeta,
  parseSwissvotes,
  swissvotesDate,
} from "../src/data-sources/swissvotes/index";
import { parseVoteDates, voteDatesQuery } from "../src/data-sources/lindas/vote-dates";
import { buildPoliticsState } from "../src/data-sources/politics/index";
import { PoliticsState, VoteResult } from "../src/state/politics";

const fx = (f: string) => readFileSync(join(__dirname, "fixtures/politics", f), "utf8");

describe("BFS vote cube", () => {
  it("splits vote labels into date and title", () => {
    expect(splitVoteLabel("2026-06-14 Zivildienstgesetz")).toEqual({
      date: "2026-06-14",
      title: "Zivildienstgesetz",
    });
  });
  it("parses yes-% and turnout for the country, cantons and municipalities", () => {
    const d = JSON.parse(fx("pxweb-vote-6870.json")) as JsonStat2;
    const r = parseVoteResult(
      d,
      { id: "6870", date: "2026-06-14", title: { de: "Zivildienstgesetz" } },
      2026,
      "2026-09-08T12:00:00Z",
    );
    expect(VoteResult.parse(r)).toBeTruthy();
    expect(r.status).toBe("final");
    expect(r.national).toEqual({ yesPct: 52.46, turnoutPct: 58.26 });
    expect(r.byCanton.ZH).toEqual({ yesPct: 49.81, turnoutPct: 60.07 });
    expect(r.byMunicipality["1"]).toEqual({ yesPct: 58.5, turnoutPct: 71.98 }); // Aeugst am Albis
    expect(r.byMunicipality["261"]).toEqual({ yesPct: 35.25, turnoutPct: 63.63 }); // Zürich rejected it
    expect(Object.keys(r.byMunicipality).length).toBeGreaterThan(2000);
    expect(Object.keys(r.byCanton)).toHaveLength(26);
  });
});

describe("swissvotes", () => {
  const rows = parseSwissvotes(fx("swissvotes-sample.csv"));
  it("reads titles, legal form and results; ids match the BFS cube", () => {
    expect(swissvotesDate("14.06.2026")).toBe("2026-06-14");
    const z = rows.find((r) => r.id === "6870")!;
    expect(z.date).toBe("2026-06-14");
    expect(z.title.en).toContain("Civilian Service");
    expect(z.kind).toBe("optional-referendum");
    expect(z.national).toMatchObject({ yesPct: 52.46, turnoutPct: 58.26, accepted: true });
    const upcoming = rows.find((r) => r.id === "6880")!;
    expect(upcoming.date).toBe("2026-09-27");
    expect(upcoming.national.yesPct).toBeNull();
    expect(upcoming.kind).toBe("initiative");
  });
  it("enriches cube metadata", () => {
    const map = new Map(rows.map((r) => [r.id, r]));
    const m = enrichVoteMeta({ id: "6870", date: "2026-06-14", title: { de: "ZDG" } }, map);
    expect(m.anr).toBe(687);
    expect(m.title.de).toBe("ZDG");
    expect(m.title.en).toContain("Civilian");
    expect(m.national?.accepted).toBe(true);
  });
});

describe("vote dates", () => {
  it("parses the LINDAS calendar and builds the query", () => {
    expect(voteDatesQuery("2026-01-01")).toContain('STR(?date) >= "2026-01-01"');
    const dates = parseVoteDates({
      results: {
        bindings: [
          {
            date: { value: "2026-09-27" },
            n: { value: "2" },
            typ: { value: ".../typ/festgelegt" },
          },
          { date: { value: "2027-02-28" }, n: { value: "-" }, typ: { value: ".../typ/blanko" } },
          {
            date: { value: "2027-10-24" },
            n: { value: "-" },
            typ: { value: ".../typ/nationalratswahlen" },
          },
        ],
      },
    });
    expect(dates).toEqual([
      { date: "2026-09-27", proposals: 2, type: "scheduled" },
      { date: "2027-02-28", type: "blank" },
      { date: "2027-10-24", type: "elections" },
    ]);
  });
});

describe("politics state", () => {
  it("assembles the state with upcoming scheduled dates only", () => {
    const now = new Date("2026-09-08T12:00:00Z");
    const s = buildPoliticsState(
      {
        schemaVersion: 1,
        generatedAt: "2026-09-07T00:00:00Z",
        geoVintage: 2026,
        votes: [{ id: "6870", date: "2026-06-14", title: { de: "ZDG" } }],
        dates: [
          { date: "2026-06-14", proposals: 2, type: "used" },
          { date: "2026-09-27", proposals: 2, type: "scheduled" },
          { date: "2027-02-28", type: "blank" },
        ],
      },
      [],
      now,
    );
    expect(PoliticsState.parse(s)).toBeTruthy();
    expect(s.freshness).toBe("live");
    expect(s.latestDate).toBe("2026-06-14");
    expect(s.upcoming.map((d) => d.date)).toEqual(["2026-09-27"]);
  });
});
