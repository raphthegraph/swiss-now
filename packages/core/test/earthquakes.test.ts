import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildSeismicState,
  fdsnToEvents,
  fdsnUrl,
  magnitudeSeverity,
  parseFdsnText,
} from "../src/data-sources/earthquakes/index";

const text = readFileSync(new URL("./fixtures/sed-sample.txt", import.meta.url), "utf8");

describe("SED FDSN", () => {
  it("parses the text format", () => {
    const ev = parseFdsnText(text);
    expect(ev.length).toBeGreaterThan(30);
    expect(ev[0]!.id).toBe("2026rufhqw");
    expect(ev[0]!.time).toMatch(/Z$/);
    expect(ev[0]!.place).toBe("Courmayeur I");
    expect(ev.some((e) => e.type === "quarry blast")).toBe(true);
  });
  it("keeps earthquakes only, rounds, ranks severity by magnitude, newest first", () => {
    const events = fdsnToEvents(parseFdsnText(text));
    expect(events.every((e) => e.kind === "earthquake" && e.reviewed)).toBe(true);
    expect(events.length).toBeLessThan(parseFdsnText(text).length);
    for (let i = 1; i < events.length; i++)
      expect(events[i - 1]!.startsAt >= events[i]!.startsAt).toBe(true);
    expect(magnitudeSeverity(1.9)).toBe(1);
    expect(magnitudeSeverity(2.5)).toBe(2);
    expect(magnitudeSeverity(4.4)).toBe(4);
    expect(events[0]!.headline.en).toMatch(/^M\d\.\d earthquake near /);
  });
  it("builds a state with the window and latest event", () => {
    const state = buildSeismicState(parseFdsnText(text), new Date("2026-09-08T12:00:00Z"));
    expect(state.windowDays).toBe(30);
    expect(state.latestEventAt).toBe("2026-09-08T05:54:42.465Z");
    expect(state.freshness).toBe("live");
    expect(fdsnUrl(new Date("2026-09-08T12:00:00Z"))).toContain(
      "starttime=2026-08-09T12%3A00%3A00",
    );
  });
});
