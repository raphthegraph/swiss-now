import { legendTicks } from "@swiss-now/motion/scales";
import type { ScaleStopsKey } from "@swiss-now/motion/tokens";

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
  const ticks = legendTicks(scale);
  const gradient = `linear-gradient(90deg, ${ticks.map((t, i) => `${t.color} ${(i / (ticks.length - 1)) * 100}%`).join(", ")})`;
  return (
    <div className="legend legend--ramp" aria-label={`${label} legend`}>
      <span className="label">{label}</span>
      <div className="ramp">
        <div className="ramp__bar" style={{ background: gradient }} />
        <div className="ramp__ticks tnum">
          {ticks.map((t) => (
            <span key={t.value}>
              {t.value}
              {unit}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
