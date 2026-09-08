"use client";

import { useState } from "react";
import { Player } from "@remotion/player";
import type { StorySpec } from "@swiss-now/core";
import { VIDEO_FPS } from "@swiss-now/motion/specs";
import { SwitzerlandToday, storyDurationInFrames } from "@swiss-now/story-video";

/**
 * The Remotion Player on /today: the only place the website plays a genuine time-based
 * composition (docs/MOTION_SYSTEM.md). Mounted on demand so the page stays light — the plate
 * loads a second MapLibre instance and the tiles for every chapter.
 */
export function StoryPlayer({ story }: { story: StorySpec }) {
  const [open, setOpen] = useState(false);
  const duration = storyDurationInFrames(story, VIDEO_FPS);
  const seconds = Math.round(duration / VIDEO_FPS);
  if (!open) {
    return (
      <button type="button" className="video-poster" onClick={() => setOpen(true)}>
        <span className="video-poster__mark" aria-hidden="true">
          ▶
        </span>
        <span>Play the {seconds}-second version</span>
        <span className="label">1080 × 1920 · rendered in your browser</span>
      </button>
    );
  }
  return (
    <div className="video-frame">
      <Player
        component={SwitzerlandToday}
        inputProps={{ story }}
        durationInFrames={duration}
        fps={VIDEO_FPS}
        compositionWidth={1080}
        compositionHeight={1920}
        controls
        loop
        autoPlay
        style={{ width: "100%", aspectRatio: "9 / 16" }}
        renderLoading={() => <div className="video-frame__loading label">Loading the map…</div>}
      />
    </div>
  );
}
