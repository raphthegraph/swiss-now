"use client";

import { Mode, TOPICS, type ViewState } from "@swiss-now/core/topics";
import { useT } from "@/lib/i18n/lang";

/**
 * The view switcher (docs/IA.md §2), top right of the map: the same topic explored
 * geographically, analytically, historically or comparatively. Modes a topic cannot do stay in
 * place, dimmed, so the switcher never jumps.
 */
export function ModeSwitcher({ view, onChange }: { view: ViewState; onChange: (m: Mode) => void }) {
  const { t } = useT();
  const supported = TOPICS[view.topic].modes;
  return (
    <nav className="modes" aria-label={t("view")}>
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
            {t(`mode.${m}`)}
          </button>
        );
      })}
    </nav>
  );
}
