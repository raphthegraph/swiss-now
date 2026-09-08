"use client";

import { useT } from "@/lib/i18n/lang";

/** What the marks mean (docs/PRODUCT_VISION.md §4: interpolation is always labelled). */
export function RailLegend({
  loaded,
  needed,
  accelerated = false,
}: {
  loaded: number;
  needed: number;
  accelerated?: boolean;
}) {
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
      {accelerated ? (
        <span className="legend__item legend__item--note">{t("accelerated", { k: 12 })}</span>
      ) : null}
      {loading ? (
        <span className="legend__item label">{t("loadingRoutes", { loaded, needed })}</span>
      ) : null}
    </div>
  );
}
