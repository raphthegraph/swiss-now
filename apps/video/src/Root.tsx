import { Composition, staticFile } from "remotion";
// the state subpath only: the package root also exports Node-only adapters (h5wasm, pngjs)
import { StorySpec } from "@swiss-now/core/state";
import { VIDEO_FPS } from "@swiss-now/motion/specs";
import {
  SwitzerlandToday,
  calculateSwitzerlandTodayMetadata,
  storyDurationInFrames,
} from "@swiss-now/story-video";
import { PlateSpike } from "./spike/PlateSpike";
import fixture from "../fixtures/story-2026-09-08.json";
import sample from "../fixtures/story-sample-stage6.json";

/** Assets are served from public/ (same layout as the web app; see scripts/copy-maplibre-worker.mjs). */
const assets = {
  styleUrl: staticFile("map/swiss-now-light.json"),
  workerUrl: staticFile("map/vendor/maplibre-gl-worker.mjs"),
  topoUrl: staticFile("geo/ch-2026.topo.json"),
};
// A saved /api/story/today response: renders are deterministic and network-free for story data.
// Pass --props='{"storyUrl":"http://localhost:3100/api/story/today"}' to render the live story instead.
const story = StorySpec.parse(fixture);
const defaultProps = { story, storyUrl: null, assets };
// a story with every chapter type (energy arrows, hazard, events, a vote choropleth) for checks
const sampleStory = StorySpec.parse(sample);

export const RemotionRoot = () => (
  <>
    {/* "Switzerland Today" — vertical for Shorts/Reels/TikTok (primary) and landscape. */}
    <Composition
      id="SwitzerlandToday"
      component={SwitzerlandToday}
      fps={VIDEO_FPS}
      width={1080}
      height={1920}
      durationInFrames={storyDurationInFrames(story, VIDEO_FPS)}
      defaultProps={defaultProps}
      calculateMetadata={calculateSwitzerlandTodayMetadata}
    />
    <Composition
      id="SwitzerlandTodayWide"
      component={SwitzerlandToday}
      fps={VIDEO_FPS}
      width={1920}
      height={1080}
      durationInFrames={storyDurationInFrames(story, VIDEO_FPS)}
      defaultProps={defaultProps}
      calculateMetadata={calculateSwitzerlandTodayMetadata}
    />
    <Composition
      id="SwitzerlandTodaySample"
      component={SwitzerlandToday}
      fps={VIDEO_FPS}
      width={1080}
      height={1920}
      durationInFrames={storyDurationInFrames(sampleStory, VIDEO_FPS)}
      defaultProps={{ story: sampleStory, storyUrl: null, assets }}
    />
    {/* Spike B (Phase 0): proves the shared style, tokens, scales and primitives render in the video target. */}
    <Composition
      id="SwissNowPlateSpike"
      component={PlateSpike}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ title: "Switzerland right now" }}
    />
  </>
);
