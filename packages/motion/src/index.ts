/**
 * @swiss-now/motion — shared visual and motion system.
 * Rule: no React-DOM, MapLibre, GSAP, Motion or Remotion imports in this package.
 * The React SVG primitives live under `@swiss-now/motion/svg` and are not re-exported here,
 * so consumers without React (e.g. the ingestion CLI) can import tokens and math freely.
 */
export * from "./tokens/index";
export * from "./scales/index";
export * from "./math/index";
export * from "./specs/index";
