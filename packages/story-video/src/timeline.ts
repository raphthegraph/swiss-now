import type { Chapter, StorySpec } from "@swiss-now/core";
import { clamp01 } from "@swiss-now/motion/math";
import { secondsToFrames } from "@swiss-now/motion/specs";

/** Crossfade length between sequences; the map dips to paper over the same frames. */
export const TRANSITION_FRAMES = 12;
export const TITLE_SECONDS = 2.8;
export const CREDITS_SECONDS = 3.4;

interface SequenceBase {
  index: number;
  /** First frame of the sequence in composition time (sequences overlap by TRANSITION_FRAMES). */
  from: number;
  durationInFrames: number;
}
export type StorySequence =
  | (SequenceBase & { kind: "title" })
  | (SequenceBase & { kind: "chapter"; chapter: Chapter; chapterIndex: number })
  | (SequenceBase & { kind: "credits" });

export interface StoryTimeline {
  fps: number;
  sequences: StorySequence[];
  /** Total length: sum of sequences minus the overlaps. */
  durationInFrames: number;
  /** Frame at the centre of each crossfade (map jumps and paper dips happen here). */
  cuts: number[];
}

/** Title → chapters (durationHint each) → credits, with a TRANSITION_FRAMES crossfade between all. */
export function storyTimeline(story: StorySpec, fps: number): StoryTimeline {
  const minChapter = TRANSITION_FRAMES * 3;
  const lengths: { kind: StorySequence["kind"]; d: number; chapter?: Chapter; ci?: number }[] = [
    { kind: "title", d: secondsToFrames(TITLE_SECONDS, fps) },
    ...story.chapters.map((chapter, ci) => ({
      kind: "chapter" as const,
      d: Math.max(secondsToFrames(chapter.durationHint, fps), minChapter),
      chapter,
      ci,
    })),
    { kind: "credits", d: secondsToFrames(CREDITS_SECONDS, fps) },
  ];
  const sequences: StorySequence[] = [];
  const cuts: number[] = [];
  let from = 0;
  lengths.forEach((l, index) => {
    if (index > 0) {
      from -= TRANSITION_FRAMES;
      cuts.push(from + TRANSITION_FRAMES / 2);
    }
    const base = { index, from, durationInFrames: l.d };
    sequences.push(
      l.kind === "chapter"
        ? { ...base, kind: "chapter", chapter: l.chapter!, chapterIndex: l.ci! }
        : { ...base, kind: l.kind },
    );
    from += l.d;
  });
  return { fps, sequences, durationInFrames: from, cuts };
}

/** The sequence that owns `frame`: ownership changes at the centre of each crossfade. */
export function sequenceAt(tl: StoryTimeline, frame: number): StorySequence {
  let i = 0;
  while (i < tl.cuts.length && frame >= tl.cuts[i]!) i++;
  return tl.sequences[Math.min(i, tl.sequences.length - 1)]!;
}

/** 0–1 paper overlay opacity: 1 exactly at a cut, 0 half a transition away. Hides the map jump. */
export function dipOpacity(tl: StoryTimeline, frame: number): number {
  let o = 0;
  for (const c of tl.cuts)
    o = Math.max(o, clamp01(1 - Math.abs(frame - c) / (TRANSITION_FRAMES / 2)));
  return o;
}

/** Convenience for the web Player, which needs the duration up front. */
export function storyDurationInFrames(story: StorySpec, fps: number): number {
  return storyTimeline(story, fps).durationInFrames;
}
