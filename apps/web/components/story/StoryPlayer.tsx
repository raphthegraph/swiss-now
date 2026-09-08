"use client";

import { useState } from "react";
import { Player } from "@remotion/player";
import type { StorySpec } from "@swiss-now/core";
import type { UiLang } from "@swiss-now/core/i18n";
import { useT } from "@/lib/i18n/lang";
import { VIDEO_FPS } from "@swiss-now/motion/specs";
import { SwitzerlandToday, storyDurationInFrames } from "@swiss-now/story-video";

/**
 * The Remotion Player on /today: the only place the website plays a genuine time-based
 * composition (docs/MOTION_SYSTEM.md). Mounted on demand so the page stays light — the plate
 * loads a second MapLibre instance and the tiles for every chapter.
 */
export function StoryPlayer({ story, lang }: { story: StorySpec; lang: UiLang }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const duration = storyDurationInFrames(story, VIDEO_FPS);
  const seconds = Math.round(duration / VIDEO_FPS);
  if (!open) {
    return (
      <button type="button" className="video-poster" onClick={() => setOpen(true)}>
        <span className="video-poster__mark" aria-hidden="true">
          ▶
        </span>
        <span>{t("playSeconds", { s: seconds })}</span>
        <span className="label">{t("renderedInBrowser")}</span>
      </button>
    );
  }
  return (
    <div className="video-frame">
      <Player
        component={SwitzerlandToday}
        inputProps={{ story, lang }}
        durationInFrames={duration}
        fps={VIDEO_FPS}
        compositionWidth={1080}
        compositionHeight={1920}
        controls
        loop
        autoPlay
        style={{ width: "100%", aspectRatio: "9 / 16" }}
        renderLoading={() => <div className="video-frame__loading label">{t("loadingMap")}</div>}
      />
    </div>
  );
}
