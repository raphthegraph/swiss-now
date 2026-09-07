import type { CSSProperties } from "react";
import { fontFamily, tabularFigures, typeScale, type TypeScaleKey } from "../tokens/type.js";
import { ground } from "../tokens/color.js";
import { easeHouse, lerp } from "../math/easing.js";

export interface MetricProps {
  /** Final value to display. */
  value: number;
  /** 0–1. The displayed number interpolates from `from` (default 0) to `value` with the house curve. */
  progress?: number;
  from?: number;
  /** Decimal places. */
  decimals?: number;
  unit?: string;
  label?: string;
  size?: TypeScaleKey;
  color?: string;
  /** Position inside the parent SVG. */
  x?: number;
  y?: number;
  textAnchor?: "start" | "middle" | "end";
  /** Locale for number formatting; Swiss German uses ’ as thousands separator. */
  locale?: string;
}

export function formatMetric(value: number, decimals = 0, locale = "de-CH"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Stateless animated number as an SVG group. Owns no timers: the web drives `progress` with Motion,
 * Remotion drives it with `interpolate(frame, …)`.
 */
export function Metric({
  value,
  progress = 1,
  from = 0,
  decimals = 0,
  unit,
  label,
  size = "metric",
  color = ground.ink,
  x = 0,
  y = 0,
  textAnchor = "start",
  locale = "de-CH",
}: MetricProps) {
  const t = typeScale[size];
  const shown = lerp(from, value, easeHouse(progress));
  const numberStyle: CSSProperties = {
    fontFamily: fontFamily.sans,
    fontSize: t.size,
    fontWeight: 500,
    letterSpacing: `${t.tracking}em`,
    fontFeatureSettings: tabularFigures,
    fill: color,
  };
  const labelStyle: CSSProperties = {
    fontFamily: fontFamily.sans,
    fontSize: typeScale.label.size,
    letterSpacing: `${typeScale.label.tracking}em`,
    textTransform: "uppercase",
    fill: ground.graphite,
  };
  return (
    <g transform={`translate(${x} ${y})`}>
      {label ? (
        <text style={labelStyle} y={-t.size * 0.9} textAnchor={textAnchor}>
          {label}
        </text>
      ) : null}
      <text style={numberStyle} textAnchor={textAnchor}>
        {formatMetric(shown, decimals, locale)}
        {unit ? (
          <tspan style={{ fontSize: t.size * 0.55, fill: ground.graphite }} dx={t.size * 0.12}>
            {unit}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}
