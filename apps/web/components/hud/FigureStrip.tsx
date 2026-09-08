"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info } from "lucide-react";
import { duration } from "@swiss-now/motion/tokens";
import { getSource } from "@swiss-now/core/sources";
import { TOPICS, type Figure, type TopicId } from "@swiss-now/core/topics";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";
import { LangSwitch } from "./LangSwitch";
import { Mark } from "../brand/Mark";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface FigureStripProps {
  topic: TopicId;
  figures: Figure[];
}

/** Attribution for the topic's sources, from the registry, plus the basemap. */
function credits(topic: TopicId): string[] {
  const ids =
    topic === "now"
      ? ["weather", "water", "rail", "hazards", "energy"].flatMap(
          (x) => TOPICS[x as TopicId].sources,
        )
      : TOPICS[topic].sources;
  const out = new Set<string>();
  for (const id of ids) out.add(getSource(id).attribution);
  out.add("© swisstopo");
  return [...out];
}

/** Attribution lines shortened to the acronym the public knows; the full names stay in the sources sheet. */
const SHORT: [RegExp, string][] = [
  [/Federal Office for the Environment FOEN/, "FOEN"],
  [/Swiss Seismological Service \(SED\) at ETH Zurich/, "SED / ETH Zurich"],
  [/WSL Institute for Snow and Avalanche Research SLF/, "SLF"],
  [/Federal Statistical Office/, "BFS"],
  [/Energy-Charts\.info \(Fraunhofer ISE\)/, "Energy-Charts"],
];
function shortSource(s: string): string {
  return SHORT.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

/**
 * The bottom bar (docs/DESIGN.md): key figures in cells with their own source line, the contour
 * mark, the language switch and an info button that lists every source of the view.
 */
export function FigureStrip({ topic, figures }: FigureStripProps) {
  const { t, l } = useT();
  const ref = useRef<HTMLElement>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const creditList = credits(topic);
  // the bar's height is published for the phone layout (the topic row and sheets sit above it)
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
      className="bar"
      aria-label={t("keyFigures")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.layerSwitch / 1000, ease: EASE, delay: 0.08 }}
    >
      <div className="strip" aria-busy={figures.length === 0}>
        {figures.length === 0
          ? [0, 1, 2, 3].map((i) => (
              <div className="metric metric--hud metric--skeleton" key={`s${i}`} aria-hidden="true">
                <div className="skeleton skeleton--label" />
                <div className="skeleton skeleton--value" />
                <div className="skeleton skeleton--where" />
              </div>
            ))
          : null}
        <AnimatePresence mode="popLayout" initial={false}>
          {figures.map((f) => (
            <motion.div
              className="metric metric--hud"
              key={f.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: duration.panel / 1000, ease: EASE }}
            >
              <div className="label">{l(f.label)}</div>
              <div className="value tnum">
                {f.text ?? formatNumber(f.value, f.decimals)}
                {f.unit ? <span className="unit">{f.unit}</span> : null}
              </div>
              {f.where ? <div className="where">{f.where}</div> : null}
              {f.source ? <div className="source">{shortSource(f.source)}</div> : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="bar__mark" aria-hidden="true">
        <Mark size={72} />
      </div>
      <div className="bar__tools">
        <LangSwitch />
        <button
          type="button"
          className="sources-button"
          aria-label={t("sources", { n: creditList.length })}
          aria-expanded={sourcesOpen}
          onClick={() => setSourcesOpen((o) => !o)}
        >
          <Info size={18} strokeWidth={1.75} />
        </button>
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
          <p className="sheet__foot">
            <Link href="/status">{t("status")}</Link>
          </p>
        </div>
      ) : null}
    </motion.section>
  );
}
