"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { duration } from "@swiss-now/motion/tokens";
import { getSource } from "@swiss-now/core/sources";
import { TOPICS, type Figure, type TopicId } from "@swiss-now/core/topics";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";
import { LangSwitch } from "./LangSwitch";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface FigureStripProps {
  topic: TopicId;
  figures: Figure[];
  /** Instrument above the figures (a scrubber). */
  children?: ReactNode;
  legend?: ReactNode;
}

/** Attribution for the topic's sources, from the registry, plus the basemap. */
function credits(topic: TopicId): string[] {
  const ids =
    topic === "now"
      ? ["weather", "water", "rail", "hazards"].flatMap((x) => TOPICS[x as TopicId].sources)
      : TOPICS[topic].sources;
  const out = new Set<string>();
  for (const id of ids) out.add(getSource(id).attribution);
  out.add("© swisstopo");
  return [...out];
}

/** The bottom HUD: instrument, legend, key figures and colophon. */
export function FigureStrip({ topic, figures, children, legend }: FigureStripProps) {
  const { t, l } = useT();
  const ref = useRef<HTMLElement>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const creditList = credits(topic);
  // the strip's height drives where the horizontal rail and the charts sheet end on small screens
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry)
        document.documentElement.style.setProperty(
          "--sn-strip-h",
          `${Math.round(entry.contentRect.height)}px`,
        );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.section
      ref={ref}
      className="hud hud--bottom"
      aria-label={t("keyFigures")}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.layerSwitch / 1000, ease: EASE, delay: 0.08 }}
    >
      {children}
      {legend}
      <div className="strip">
        <AnimatePresence mode="popLayout" initial={false}>
          {figures.map((f) => (
            <motion.div
              className="metric metric--hud"
              key={f.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: duration.panel / 1000, ease: EASE }}
            >
              <div className="label">{l(f.label)}</div>
              <div className="value tnum">
                {f.text ?? formatNumber(f.value, f.decimals)}
                {f.unit ? <span className="unit">{f.unit}</span> : null}
              </div>
              {f.where ? <div className="where">{f.where}</div> : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="colophon colophon--hud">
        {creditList.map((c) => (
          <span className="credit" key={c}>
            {c}
          </span>
        ))}
        <button
          type="button"
          className="sources-button"
          aria-expanded={sourcesOpen}
          onClick={() => setSourcesOpen((o) => !o)}
        >
          {t("sources", { n: creditList.length })}
        </button>
        <Link href="/status">{t("status")}</Link>
        <LangSwitch />
      </div>
      {sourcesOpen ? (
        <div className="sheet" role="dialog" aria-label={t("sourcesTitle")}>
          <div className="sheet__head">
            <span className="label">{t("sourcesTitle")}</span>
            <button type="button" className="sheet__close" onClick={() => setSourcesOpen(false)}>
              {t("close")}
            </button>
          </div>
          <ul className="sheet__list">
            {creditList.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </motion.section>
  );
}
