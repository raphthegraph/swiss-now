/** Selectable views. QUAKES joins in Phase 3; TRAFFIC/AIR/ENERGY in Phase 5. */
export type ActiveLayer = "now" | "weather" | "rail" | "water";
export const LAYER_RAIL: { id: ActiveLayer; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "weather", label: "Weather" },
  { id: "rail", label: "Rail" },
  { id: "water", label: "Water" },
];
