import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { StorySpec } from "@swiss-now/core";
import { easeHouse } from "@swiss-now/motion/math";
import { ground } from "@swiss-now/motion/tokens";
import type { UiLang } from "@swiss-now/core/i18n";
import { layoutFor } from "./layout";
import { chapterTopicLabel, formatStoryDate, vs } from "./strings";

export { formatStoryDate };

export function TitleCard({ story, lang = "en" }: { story: StorySpec; lang?: UiLang }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const L = layoutFor(width, height);
  const rise = (from: number) =>
    easeHouse(
      interpolate(frame, [from, from + fps * 0.7], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  const a1 = rise(2);
  const a2 = rise(10);
  const rule = rise(6);
  const size = L.portrait ? 128 : 112;
  const layers = [...new Set(story.chapters.map((c) => chapterTopicLabel(c, lang)))].join(" · ");
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: L.portrait
            ? `linear-gradient(180deg, rgba(244,243,239,0) ${Math.round((L.column.top / height) * 100) - 8}%, rgba(244,243,239,0.94) ${Math.round((L.column.top / height) * 100) + 14}%)`
            : "linear-gradient(90deg, rgba(244,243,239,0.96) 42%, rgba(244,243,239,0) 66%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: L.column.left,
          width: L.portrait ? L.column.width : L.column.width + 120,
          top: L.column.top,
          bottom: L.column.bottom,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          color: ground.ink,
        }}
      >
        <div
          style={{
            fontSize: L.label,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: ground.graphite,
            opacity: a1,
            transform: `translateY(${(1 - a1) * 16}px)`,
          }}
        >
          {vs("dayIn", lang, { n: story.chapters.length })} · {layers}
        </div>
        <div
          style={{
            height: 2,
            background: ground.ink,
            width: `${rule * 100}%`,
            margin: "18px 0 26px",
          }}
        />
        <div
          style={{
            fontSize: size,
            lineHeight: 0.98,
            fontWeight: 500,
            letterSpacing: "-0.025em",
            opacity: a2,
            transform: `translateY(${(1 - a2) * 28}px)`,
          }}
        >
          {vs("switzerland", lang)}
          <br />
          <span style={{ color: ground.graphite }}>{vs("today", lang)}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
