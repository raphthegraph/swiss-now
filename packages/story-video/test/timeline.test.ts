import { describe, expect, it } from "vitest";
import type { StorySpec } from "@swiss-now/core";
import { TRANSITION_FRAMES, dipOpacity, sequenceAt, storyTimeline } from "../src/timeline";

const chapter = (id: string, durationHint: number): StorySpec["chapters"][number] => ({
  id,
  type: "stat",
  layer: "weather",
  headline: { de: id, en: id },
  highlights: [],
  markers: [],
  data: {},
  camera: { center: [8, 47], zoom: 8, bearing: 0, pitch: 0 },
  durationHint,
  score: 1,
});
const story: StorySpec = {
  schemaVersion: 1,
  date: "2026-09-08",
  generatedAt: "2026-09-08T12:00:00Z",
  title: { de: "t", en: "t" },
  chapters: [chapter("a", 6), chapter("b", 5)],
  credits: ["© swisstopo"],
};

describe("story timeline", () => {
  it("overlaps sequences by the transition length and hands ownership over at cut centres", () => {
    const tl = storyTimeline(story, 30);
    expect(tl.sequences.map((s) => s.kind)).toEqual(["title", "chapter", "chapter", "credits"]);
    const sum = tl.sequences.reduce((a, s) => a + s.durationInFrames, 0);
    expect(tl.durationInFrames).toBe(sum - 3 * TRANSITION_FRAMES);
    expect(tl.cuts).toHaveLength(3);
    const c0 = tl.cuts[0]!;
    expect(sequenceAt(tl, c0 - 1).kind).toBe("title");
    expect(sequenceAt(tl, c0).kind).toBe("chapter");
    expect(dipOpacity(tl, c0)).toBe(1);
    expect(dipOpacity(tl, c0 - TRANSITION_FRAMES / 2)).toBe(0);
    expect(dipOpacity(tl, c0 + TRANSITION_FRAMES / 4)).toBeCloseTo(0.5);
    expect(sequenceAt(tl, tl.durationInFrames - 1).kind).toBe("credits");
  });
});
