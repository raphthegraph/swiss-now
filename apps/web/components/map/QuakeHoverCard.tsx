"use client";

import type { QuakeHover } from "./QuakeLayer";
import { formatAgo, formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

export function QuakeHoverCard({ hover }: { hover: QuakeHover }) {
  const { t, l, lang } = useT();
  const { event: e, point } = hover;
  return (
    <div
      className="hover-card hover-card--quake"
      style={{ transform: `translate(${point.x + 14}px, ${point.y - 12}px)` }}
    >
      <div className="hover-card__name">{l(e.headline)}</div>
      <div className="hover-card__value tnum">M {formatNumber(e.magnitude ?? 0, 1)}</div>
      <div className="hover-card__meta tnum">
        {t("depth", { v: formatNumber(e.depthKm ?? 0, 0) })} ·{" "}
        {formatAgo(Date.now() - new Date(e.startsAt).getTime(), lang)} ·{" "}
        {formatDateTime(e.startsAt, lang)}
      </div>
      <div className="hover-card__meta">{t("reviewedNote")} · Source: SED / ETH Zurich</div>
    </div>
  );
}
