import { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
// the state subpath only: the package root also exports Node-only adapters (h5wasm, pngjs)
import { StorySpec } from "@swiss-now/core/state";
import { easeHouse, projectOnPlate } from "@swiss-now/motion/math";
import { SWITZERLAND_CAMERA, VIDEO_FPS } from "@swiss-now/motion/specs";
import { fontFamily, ground } from "@swiss-now/motion/tokens";
import { FixedMapPlate, type MapAssets, type PlateCamera } from "./FixedMapPlate";
import { Markers } from "./Markers";
import { ChapterHud } from "./hud/ChapterHud";
import { CreditsCard } from "./hud/CreditsCard";
import { TitleCard, formatStoryDate } from "./hud/TitleCard";
import { layoutFor } from "./hud/layout";
import {
  TRANSITION_FRAMES,
  dipOpacity,
  sequenceAt,
  storyTimeline,
  type StorySequence,
} from "./timeline";
import "./fonts";

// a type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props constraint
export type SwitzerlandTodayProps = {
  story: StorySpec;
  /** When set, `calculateMetadata` fetches the story from here (e.g. /api/story/today) and replaces `story`. */
  storyUrl?: string | null;
  assets?: MapAssets;
};

/** Same public layout as the web app, so the Player on /today needs no configuration. */
export const DEFAULT_ASSETS: MapAssets = {
  styleUrl: "/map/swiss-now-light.json",
  workerUrl: "/map/vendor/maplibre-gl-worker.mjs",
};

/** Plate is 2× the frame; the push-in keeps the CSS scale ≤ 1 (render-stability.md). */
const PLATE_SCALE = 2;
const PUSH_IN = 0.45;

function plateFor(seq: StorySequence): PlateCamera {
  return seq.kind === "chapter"
    ? { center: seq.chapter.camera.center, zoom: seq.chapter.camera.zoom }
    : { center: SWITZERLAND_CAMERA.center, zoom: SWITZERLAND_CAMERA.zoom };
}

/** Frame camera within a sequence: a slow decelerating push-in; the credits drift back out. */
function cameraAt(seq: StorySequence, plate: PlateCamera, localFrame: number): PlateCamera {
  const t = easeHouse(Math.min(1, Math.max(0, localFrame / seq.durationInFrames)));
  const amount = seq.kind === "title" ? 0.25 : seq.kind === "credits" ? -0.2 : PUSH_IN;
  const zoom = seq.kind === "credits" ? plate.zoom + amount * t : plate.zoom - amount * (1 - t);
  return { center: plate.center, zoom };
}

export const calculateSwitzerlandTodayMetadata: CalculateMetadataFunction<
  SwitzerlandTodayProps
> = async ({ props }) => {
  let story = props.story;
  if (props.storyUrl) {
    const res = await fetch(props.storyUrl);
    if (!res.ok) throw new Error(`story fetch failed: ${res.status} ${props.storyUrl}`);
    story = StorySpec.parse(await res.json());
  }
  return {
    props: { ...props, story },
    durationInFrames: storyTimeline(story, VIDEO_FPS).durationInFrames,
  };
};

/**
 * "Switzerland Today": title → ranked chapters → credits, over one fixed MapLibre plate that jumps
 * at each cut under a dip to paper. Data markers are SVG projected through the plate transform.
 */
export function SwitzerlandToday({ story, assets = DEFAULT_ASSETS }: SwitzerlandTodayProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const tl = useMemo(() => storyTimeline(story, fps), [story, fps]);
  const seq = sequenceAt(tl, frame);
  const L = layoutFor(width, height);
  const plateW = width * PLATE_SCALE;
  const plateH = height * PLATE_SCALE;
  const plate = plateFor(seq);
  const localFrame = frame - seq.from;
  const camera = cameraAt(seq, plate, localFrame);
  const scale = 2 ** (camera.zoom - plate.zoom);
  const p = projectOnPlate(camera.center, plate.center, plate.zoom, plateW, plateH);
  const tx = L.focus.x - p.x * scale;
  const ty = L.focus.y - p.y * scale;
  const chapters = story.chapters;
  const progress = frame / Math.max(1, tl.durationInFrames - 1);
  const cutCentre = seq.from + (seq.index === 0 ? 0 : TRANSITION_FRAMES / 2);

  return (
    <AbsoluteFill
      style={{ background: ground.paper, overflow: "hidden", fontFamily: fontFamily.sans }}
    >
      <FixedMapPlate
        plate={plate}
        plateKey={`${seq.kind}-${seq.index}`}
        plateW={plateW}
        plateH={plateH}
        transform={`translate(${tx}px, ${ty}px) scale(${scale})`}
        assets={assets}
      />
      {seq.kind === "chapter" ? (
        <Markers
          markers={seq.chapter.markers}
          plate={plate}
          plateW={plateW}
          plateH={plateH}
          scale={scale}
          tx={tx}
          ty={ty}
          localFrame={frame - cutCentre}
          fps={fps}
          width={width}
          height={height}
          portrait={L.portrait}
        />
      ) : null}
      {/* dip to paper hides the renderer camera jump at every cut */}
      <AbsoluteFill style={{ background: ground.paper, opacity: dipOpacity(tl, frame) }} />

      <TransitionSeries>
        {tl.sequences.flatMap((s, i) => {
          const content =
            s.kind === "title" ? (
              <TitleCard story={story} />
            ) : s.kind === "credits" ? (
              <CreditsCard story={story} />
            ) : (
              <ChapterHud chapter={s.chapter} index={s.chapterIndex} total={chapters.length} />
            );
          const items = [
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={s.durationInFrames}>
              {content}
            </TransitionSeries.Sequence>,
          ];
          if (i < tl.sequences.length - 1)
            items.push(
              <TransitionSeries.Transition
                key={`t${i}`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          return items;
        })}
      </TransitionSeries>

      {/* faint paper behind the masthead so it never fights the map */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: L.portrait ? 260 : 190,
          background:
            "linear-gradient(180deg, rgba(244,243,239,0.92) 0%, rgba(244,243,239,0.7) 55%, rgba(244,243,239,0) 100%)",
        }}
      />
      {/* persistent masthead with the story progress as the rule */}
      <div
        style={{
          position: "absolute",
          left: L.margin,
          right: L.margin,
          top: L.portrait ? 84 : 56,
          color: ground.ink,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingBottom: 12,
          }}
        >
          <span
            style={{ fontSize: L.portrait ? 40 : 34, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Swiss Now
          </span>
          <span
            style={{
              fontSize: L.label,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ground.graphite,
            }}
          >
            {formatStoryDate(story.date)}
          </span>
        </div>
        <div style={{ height: 2, background: ground.mist }}>
          <div style={{ height: 2, background: ground.ink, width: `${progress * 100}%` }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
