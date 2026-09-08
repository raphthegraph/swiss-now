"use client";

import { accessForSources } from "@swiss-now/core/sources";
import { TOPIC_GROUPS, topicsInGroup, type TopicId, type ViewState } from "@swiss-now/core/topics";
import { useT } from "@/lib/i18n/lang";
import { TOPIC_ICON } from "../brand/topic-icons";

export interface TopicRailProps {
  view: ViewState;
  onSelect: (topic: TopicId) => void;
  /** Topics that stay out of the rail until they have something to show. */
  hidden?: TopicId[];
}

/**
 * The topic sidebar (docs/IA.md §1, docs/DESIGN.md): the NOW group with its live dot, then LIVE,
 * SYSTEMS and SWITZERLAND with one outline icon per topic. Only built topics whose sources pass
 * the licence policy appear; selecting one reduces the composite to that system.
 */
export function TopicRail({ view, onSelect, hidden = [] }: TopicRailProps) {
  const { t, l } = useT();
  return (
    <nav className="rail" aria-label={t("topics")}>
      {TOPIC_GROUPS.map((g) => {
        const topics = topicsInGroup(g.id).filter(
          (x) => x.built && !hidden.includes(x.id) && accessForSources(x.sources) !== "blocked",
        );
        if (!topics.length) return null;
        return (
          <div className="rail__section" key={g.id} data-group={g.id}>
            <div className={`rail__group${g.id === "now" ? " rail__group--now" : ""}`}>
              {l(g.label)}
            </div>
            <ul>
              {topics.map((x) => {
                const Icon = TOPIC_ICON[x.id];
                const current = view.topic === x.id;
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      className="rail__item"
                      aria-current={current ? "true" : undefined}
                      onClick={() => onSelect(x.id)}
                    >
                      <span className="rail__icon" aria-hidden="true">
                        {Icon ? (
                          <Icon size={18} strokeWidth={1.75} />
                        ) : (
                          <span className="rail__dot" />
                        )}
                      </span>
                      <span className="rail__label">
                        {x.id === "now" ? t("fresh.live") : l(x.label)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
