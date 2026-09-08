/** 4-px spacing grid. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
  9: 96,
} as const;
export type SpaceKey = keyof typeof space;

/** HUD margins by viewport width. */
export const hudMargin = {
  compact: 24, // < 768 px
  regular: 32, // 768–1279 px
  wide: 48, // ≥ 1280 px
} as const;

/** Hairline widths in px. */
export const stroke = { hairline: 1, rule: 1.5, emphasis: 2 } as const;

/** Radii (design direction 2026-09-08): soft cards and controls, pills for chips. */
export const radius = { none: 0, subtle: 4, control: 8, card: 12, pill: 999 } as const;

/** Elevation: one soft shadow for floating surfaces over the map. */
export const shadow = {
  card: "0 4px 24px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)",
  raised: "0 8px 32px rgba(17, 24, 39, 0.1)",
} as const;
