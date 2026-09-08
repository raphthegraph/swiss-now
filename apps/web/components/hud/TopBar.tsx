"use client";

import type { ReactNode } from "react";
import type { Freshness } from "@swiss-now/core";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";
import { Wordmark } from "../brand/Wordmark";

export interface TopBarProps {
  home?: ReactNode;
  /** Live topics show the observation clock; statistics topics pass a vintage line instead. */
  clock?: { observedAt: string; freshness: Freshness } | undefined;
  status?: ReactNode;
}

/** The white bar above everything: wordmark, home place, and the country clock with its freshness. */
export function TopBar({ home, clock, status }: TopBarProps) {
  const { t, lang } = useT();
  return (
    <header className="topbar">
      <h1 className="topbar__brand">
        <Wordmark />
      </h1>
      {home ? <div className="topbar__home">{home}</div> : null}
      <div className="topbar__status">
        {status ??
          (clock ? (
            <span className="label tnum" aria-live="polite">
              {t("switzerland")} · {formatTime(clock.observedAt, lang)} ·{" "}
              <span className="freshness" data-state={clock.freshness}>
                {t(`fresh.${clock.freshness}`)}
              </span>
            </span>
          ) : null)}
      </div>
    </header>
  );
}
