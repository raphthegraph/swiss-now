/** Typography (docs/DESIGN.md): Inter for the interface, Montserrat for the wordmark only. */
export const fontFamily = {
  sans: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
  /** The wordmark: SWISS in bold, NOW in light. */
  brand: 'Montserrat, Inter, "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
} as const;

/** Font sizes in px. Line heights are unitless multipliers. */
export const typeScale = {
  caption: { size: 12, lineHeight: 1.3, tracking: 0.01 },
  body: { size: 14, lineHeight: 1.45, tracking: 0 },
  bodyLarge: { size: 16, lineHeight: 1.45, tracking: 0 },
  label: { size: 12, lineHeight: 1.2, tracking: 0.12, uppercase: true },
  metric: { size: 28, lineHeight: 1.1, tracking: -0.01, tabular: true },
  metricLarge: { size: 40, lineHeight: 1.05, tracking: -0.015, tabular: true },
  display: { size: 64, lineHeight: 1.0, tracking: -0.02, tabular: true },
} as const;
export type TypeScaleKey = keyof typeof typeScale;

export const fontWeight = { regular: 400, medium: 500, semibold: 600 } as const;

/** Enables tabular figures wherever numbers change over time. */
export const tabularFigures = '"tnum" 1, "lnum" 1' as const;
