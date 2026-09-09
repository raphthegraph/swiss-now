"use client";

import type { ReactNode } from "react";
import type { Freshness } from "@swiss-now/core";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";
import { Wordmark } from "../brand/Wordmark";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { useGeoRegister } from "@/lib/use-geo-register";
import { PlaceSearch } from "./PlaceSearch";

export interface TopBarProps {
  home?: ReactNode;
  /** Live topics show the observation clock; statistics topics pass a vintage line instead. */
  clock?: { observedAt: string; freshness: Freshness } | undefined;
  status?: ReactNode;
}

/** The white bar above everything: wordmark, home place, and the country clock with its freshness. */
export function TopBar({ home, clock, status }: TopBarProps) {
  const { t, lang } = useT();
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const register = useGeoRegister(searching);
  return (
    <header className="topbar">
      <h1 className="topbar__brand">
        <Wordmark />
      </h1>
      {home ? <div className="topbar__home">{home}</div> : null}
      <div className="topbar__search">
        {searching ? (
          <PlaceSearch
            register={register}
            value={undefined}
            onPick={(p) => router.push(`/place/${p.key}`)}
            label={t("place.search")}
            autoFocusKey
          />
        ) : (
          <button
            type="button"
            className="topbar__search-button"
            aria-label={t("place.search")}
            onClick={() => setSearching(true)}
          >
            <Search size={16} strokeWidth={1.75} /> <span>{t("place.search")}</span>
          </button>
        )}
      </div>
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
