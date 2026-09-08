import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { StorySpec } from "@swiss-now/core";
import { easeHouse } from "@swiss-now/motion/math";
import { ground } from "@swiss-now/motion/tokens";
import type { UiLang } from "@swiss-now/core/i18n";
import { layoutFor } from "./layout";
import { formatClock, vs } from "./strings";

export function CreditsCard({ story, lang = "en" }: { story: StorySpec; lang?: UiLang }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const L = layoutFor(width, height);
  const rise = (from: number) =>
    easeHouse(
      interpolate(frame, [from, from + fps * 0.6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  const generated = formatClock(story.generatedAt, lang);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: L.portrait
            ? "linear-gradient(180deg, rgba(244,243,239,0) 30%, rgba(244,243,239,0.94) 52%)"
            : "linear-gradient(90deg, rgba(244,243,239,0.96) 42%, rgba(244,243,239,0) 66%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: L.column.left,
          width: L.column.width,
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
            opacity: rise(0),
          }}
        >
          {vs("sources", lang)}
        </div>
        <div
          style={{
            height: 2,
            background: ground.ink,
            margin: "16px 0 22px",
            width: `${rise(2) * 100}%`,
          }}
        />
        {story.credits.map((c, i) => (
          <div
            key={c}
            style={{
              fontSize: L.body,
              lineHeight: 1.5,
              opacity: rise(6 + i * 4),
              transform: `translateY(${(1 - rise(6 + i * 4)) * 12}px)`,
            }}
          >
            {c}
          </div>
        ))}
        <div
          style={{
            fontSize: L.caption,
            lineHeight: 1.45,
            color: ground.graphite,
            marginTop: 26,
            opacity: rise(10 + story.credits.length * 4),
          }}
        >
          {vs("assembled", lang, { time: generated })}
        </div>
        <div
          style={{
            fontSize: L.portrait ? 44 : 36,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            marginTop: 34,
            opacity: rise(14 + story.credits.length * 4),
          }}
        >
          Swiss Now
        </div>
      </div>
    </AbsoluteFill>
  );
}
