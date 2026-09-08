import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Chapter } from "@swiss-now/core";
import { chapterFigures } from "@swiss-now/core/story";
import { easeHouse } from "@swiss-now/motion/math";
import { Metric } from "@swiss-now/motion/svg";
import { ground } from "@swiss-now/motion/tokens";
import { chapterAccent, chapterCredit } from "../chapter-style";
import { pick, type UiLang } from "@swiss-now/core/i18n";
import { chapterTopicLabel } from "./strings";
import { layoutFor } from "./layout";

export interface ChapterHudProps {
  chapter: Chapter;
  index: number;
  total: number;
  lang?: UiLang;
}

/** Typographic block for one chapter: label, headline, body, key figures, attribution. */
export function ChapterHud({ chapter, index, total, lang = "en" }: ChapterHudProps) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const L = layoutFor(width, height);
  const accent = chapterAccent(chapter);
  const figures = chapterFigures(chapter).slice(0, 3);
  const rise = (from: number, len = 0.6) =>
    easeHouse(
      interpolate(frame, [from, from + fps * len], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  const aLabel = rise(0, 0.4);
  const aHead = rise(4);
  const aBody = rise(12);
  const aFig = rise(16, 0.4);
  const metricProgress = interpolate(frame, [fps * 0.5, fps * 1.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const figW = L.column.width / Math.max(1, figures.length);
  const svgH = 150 * (L.metricScale / 2);
  const headline = pick(chapter.headline, lang);
  const body = chapter.body ? pick(chapter.body, lang) : undefined;
  return (
    <AbsoluteFill>
      {/* paper gradient so type stays legible over the map (Swiss poster, not a card) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: L.portrait
            ? `linear-gradient(180deg, rgba(244,243,239,0) ${Math.round((L.column.top / height) * 100) - 10}%, rgba(244,243,239,0.94) ${Math.round((L.column.top / height) * 100) + 14}%)`
            : `linear-gradient(90deg, rgba(244,243,239,0.96) ${Math.round(((L.column.left + L.column.width) / width) * 100) + 2}%, rgba(244,243,239,0) ${Math.round(((L.column.left + L.column.width) / width) * 100) + 26}%)`,
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
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: L.label,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: ground.graphite,
            opacity: aLabel,
          }}
        >
          <span style={{ width: 14, height: 14, background: accent, display: "inline-block" }} />
          <span>
            {index + 1} / {total} · {chapterTopicLabel(chapter, lang)}
          </span>
        </div>
        <div
          style={{
            fontSize: L.headline,
            lineHeight: 1.08,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: "18px 0 0",
            opacity: aHead,
            transform: `translateY(${(1 - aHead) * 24}px)`,
          }}
        >
          {headline}
        </div>
        {body ? (
          <div
            style={{
              fontSize: L.body,
              lineHeight: 1.35,
              color: ground.graphite,
              margin: "18px 0 0",
              opacity: aBody,
              transform: `translateY(${(1 - aBody) * 16}px)`,
            }}
          >
            {body}
          </div>
        ) : null}
        {figures.length ? (
          <svg
            width={L.column.width}
            height={svgH}
            viewBox={`0 0 ${L.column.width / L.metricScale} ${svgH / L.metricScale}`}
            style={{ marginTop: 30, opacity: aFig, overflow: "visible" }}
          >
            {figures.map((f, i) => (
              <Metric
                key={f.label.en ?? f.label.de}
                x={(i * figW) / L.metricScale}
                y={(svgH / L.metricScale) * 0.82}
                label={pick(f.label, lang)}
                value={f.value}
                decimals={f.decimals}
                {...(f.unit ? { unit: f.unit } : {})}
                size={figures.length > 2 ? "metricLarge" : "display"}
                progress={metricProgress}
                color={i === 0 ? accent : ground.ink}
              />
            ))}
          </svg>
        ) : null}
        <div style={{ fontSize: L.caption, color: ground.graphite, marginTop: 26, opacity: aBody }}>
          {chapterCredit(chapter)}
          {chapter.type === "rail" ? " · positions estimated from timetable and live delays" : ""}
        </div>
      </div>
    </AbsoluteFill>
  );
}
