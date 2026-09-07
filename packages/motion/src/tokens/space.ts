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

/** Radii are minimal by design: no rounded SaaS cards. */
export const radius = { none: 0, subtle: 2 } as const;
