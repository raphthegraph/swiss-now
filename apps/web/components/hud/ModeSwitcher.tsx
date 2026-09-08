"use client";

import { Mode, TOPICS, type ViewState } from "@swiss-now/core/topics";

const LABEL: Record<Mode, string> = {
  map: "Map",
  charts: "Charts",
  timeline: "Timeline",
  compare: "Compare",
};

/**
 * The view switcher (docs/IA.md §2): the same topic explored geographically, analytically,
 * historically or comparatively. Modes a topic cannot do stay in place, dimmed, so the switcher
 * never jumps.
 */
export function ModeSwitcher({ view, onChange }: { view: ViewState; onChange: (m: Mode) => void }) {
  const supported = TOPICS[view.topic].modes;
  return (
    <nav className="hud hud--modes" aria-label="View">
      {Mode.options.map((m) => {
        const ok = supported.includes(m);
        return (
          <button
            key={m}
            type="button"
            className="modes__item"
            aria-pressed={view.mode === m}
            aria-disabled={ok ? undefined : "true"}
            onClick={() => ok && onChange(m)}
          >
            {LABEL[m]}
          </button>
        );
      })}
    </nav>
  );
}
