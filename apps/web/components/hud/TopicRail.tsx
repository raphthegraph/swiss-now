"use client";

import { motion } from "motion/react";
import { accessForSources } from "@swiss-now/core/sources";
import { TOPIC_GROUPS, topicsInGroup, type TopicId, type ViewState } from "@swiss-now/core/topics";
import { useT } from "@/lib/i18n/lang";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface TopicRailProps {
  view: ViewState;
  onSelect: (topic: TopicId) => void;
  /** Topics that stay out of the rail until they have something to show (hazards without a notable quake). */
  hidden?: TopicId[];
}

/**
 * The topic rail (docs/IA.md §1): NOW, then the three groups in small caps. Only built topics whose
 * sources pass the licence policy appear; selecting one reduces the composite to that system.
 */
export function TopicRail({ view, onSelect, hidden = [] }: TopicRailProps) {
  const { t, l } = useT();
  return (
    <nav className="hud hud--rail" aria-label={t("topics")}>
      {TOPIC_GROUPS.map((g) => {
        const topics = topicsInGroup(g.id).filter(
          (x) => x.built && !hidden.includes(x.id) && accessForSources(x.sources) !== "blocked",
        );
        if (!topics.length) return null;
        return (
          <div className="rail__section" key={g.id}>
            {g.id !== "now" ? <div className="rail__group">{l(g.label)}</div> : null}
            <ul>
              {topics.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className="rail__item"
                    aria-current={view.topic === x.id ? "true" : undefined}
                    onClick={() => onSelect(x.id)}
                  >
                    {view.topic === x.id ? (
                      <motion.span
                        className="rail__indicator"
                        layoutId="rail-indicator"
                        transition={{ duration: 0.24, ease: EASE }}
                      />
                    ) : null}
                    {l(x.label)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
