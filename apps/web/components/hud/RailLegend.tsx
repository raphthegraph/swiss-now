"use client";

import { useT } from "@/lib/i18n/lang";

/** What the marks mean (docs/PRODUCT_VISION.md §4: interpolation is always labelled). */
export function RailLegend({ loaded, needed }: { loaded: number; needed: number }) {
  const { t } = useT();
  const loading = needed > 0 && loaded < needed * 0.9;
  return (
    <div className="legend" aria-label={t("railLegend")}>
      <span className="legend__item">
        <span className="legend__train" /> {t("trainEstimated")}
      </span>
      <span className="legend__item">
        <span className="legend__ring" /> {t("delayedRing")}
      </span>
      <span className="legend__item">
        <span className="legend__disruption" /> {t("disruptionBetween")}
      </span>
      {loading ? (
        <span className="legend__item label">{t("loadingRoutes", { loaded, needed })}</span>
      ) : null}
    </div>
  );
}
