/** Frame geometry shared by the HUD pieces; everything scales from the composition size. */
export interface Layout {
  portrait: boolean;
  margin: number;
  /** Text column box (absolute px). */
  column: { left: number; width: number; top: number; bottom: number };
  headline: number;
  body: number;
  label: number;
  caption: number;
  /** Scale factor applied to the shared SVG `Metric` primitive (its type scale is web-sized). */
  metricScale: number;
  /** Where the camera target sits in the frame (leaves room for the text column). */
  focus: { x: number; y: number };
}

export function layoutFor(width: number, height: number): Layout {
  const portrait = height > width;
  if (portrait) {
    const margin = Math.round(width / 15);
    return {
      portrait,
      margin,
      column: { left: margin, width: width - 2 * margin, top: height * 0.5, bottom: 120 },
      headline: 68,
      body: 30,
      label: 22,
      caption: 20,
      metricScale: 2,
      focus: { x: width / 2, y: height * 0.36 },
    };
  }
  const margin = Math.round(width / 20);
  return {
    portrait,
    margin,
    column: { left: margin, width: Math.min(720, width * 0.4), top: 150, bottom: 90 },
    headline: 52,
    body: 24,
    label: 18,
    caption: 16,
    metricScale: 1.6,
    focus: { x: width * 0.64, y: height * 0.5 },
  };
}
