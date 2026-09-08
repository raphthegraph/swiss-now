import { formatNumber } from "@/lib/format";

/** A colour ramp with data-driven stops (quantile scales). */
export function DynamicRampLegend({
  stops,
  label,
  unit = "",
  decimals = 0,
}: {
  stops: [number, string][];
  label: string;
  unit?: string;
  decimals?: number;
}) {
  if (stops.length < 2) return null;
  const gradient = `linear-gradient(90deg, ${stops.map((s, i) => `${s[1]} ${(i / (stops.length - 1)) * 100}%`).join(", ")})`;
  return (
    <div className="legend legend--ramp" aria-label={`${label} legend`}>
      <span className="label">{label}</span>
      <div className="ramp">
        <div className="ramp__bar" style={{ background: gradient }} />
        <div className="ramp__ticks tnum">
          {stops.map((s) => (
            <span key={s[0]}>
              {formatNumber(s[0], s[0] >= 1000 ? 0 : decimals)}
              {unit}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
