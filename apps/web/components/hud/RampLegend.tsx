"use client";

import { legendTicks } from "@swiss-now/motion/scales";
import type { ScaleStopsKey } from "@swiss-now/motion/tokens";
import { useT } from "@/lib/i18n/lang";

/** A colour ramp with its ticks, from the shared scale stops. */
export function RampLegend({
  scale,
  label,
  unit = "",
}: {
  scale: ScaleStopsKey;
  label: string;
  unit?: string;
}) {
  const { t } = useT();
  const ticks = legendTicks(scale);
  const gradient = `linear-gradient(90deg, ${ticks.map((x, i) => `${x.color} ${(i / (ticks.length - 1)) * 100}%`).join(", ")})`;
  return (
    <div className="legend legend--ramp" aria-label={t("legend", { label })}>
      <span className="label">{label}</span>
      <div className="ramp">
        <div className="ramp__bar" style={{ background: gradient }} />
        <div className="ramp__ticks tnum">
          {ticks.map((x) => (
            <span key={x.value}>
              {x.value}
              {unit}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
