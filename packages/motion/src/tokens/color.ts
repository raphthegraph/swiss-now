/**
 * Colour tokens (design direction 2026-09-08, docs/DESIGN.md): a quiet paper ground, white
 * surfaces with hairline borders, graphite type, blue-grey secondary text, Swiss red and amber as
 * the only warm accents. Colour is reserved for information. Hex values are sRGB.
 */
export const ground = {
  /** Warm off-white paper: the page and the map ground. */
  paper: "#FAFAF8",
  /** White surfaces: cards, panels, the top bar. */
  surface: "#FFFFFF",
  /** Graphite ink for type and the night ground. */
  ink: "#111827",
  /** Blue-grey for secondary type and icons. */
  graphite: "#64748B",
  /** Light hairline / disabled. */
  mist: "#E5E7EB",
  /** Water body fill on the basemap. */
  lake: "#DCE6EE",
  /** Relief hillshade tint (multiplied over the ground). */
  relief: "#C9CDD3",
} as const;

/** Plant types on the energy map: water blues, nuclear ink, solar amber, biomass green, fossil grey. */
export const plantType = {
  "hydro-storage": "#2F5E8F",
  "hydro-pumped": "#4A7BA6",
  "hydro-run": "#7FA6C9",
  nuclear: "#111827",
  solar: "#F5A623",
  wind: "#64748B",
  biomass: "#5B8C5A",
  waste: "#8C6A3F",
  gas: "#9CA3AF",
  other: "#C9CDD3",
} as const;

/** The two warm brand accents; everything else stays cool. */
export const brand = {
  swissRed: "#E2563D",
  amber: "#F5A623",
} as const;

/** Environmental grounds derived from sun altitude over Bern (see `daylight`). */
export const daylightGround = {
  dawn: { background: "#E9E4DC", foreground: "#1B1C1F", basemapOpacity: 0.9 },
  day: { background: "#FAFAF8", foreground: "#111827", basemapOpacity: 1 },
  dusk: { background: "#2A2C33", foreground: "#EDEBE6", basemapOpacity: 0.75 },
  night: { background: "#0F1114", foreground: "#E6E4DF", basemapOpacity: 0.6 },
} as const;

/** One accent per layer. Used sparingly; the map ground stays monochrome. */
export const layerAccent = {
  weather: "#E2563D", // Swiss red for temperature extremes and the layer label
  rain: "#6B8CAE", // radar / precipitation: soft blue-grey
  wind: "#64748B", // particles are near-neutral so they read as motion, not colour
  hydrology: "#4A7BA6",
  rail: "#8B95A5", // trains are neutral grey…
  railDelay: "#E2563D", // …Swiss red is reserved for delay
  traffic: "#F5A623",
  air: "#7C6F93",
  energy: "#F5A623", // amber: the flows are the warm signal of the SYSTEMS group
  seismic: "#E2563D",
  hazards: "#C7432E", // quakes, avalanche, forest fire, hail
  events: "#111827", // events are typographic: ink, the map stays the picture
  aviation: "#5F7D8C",
  politics: "#7A4E9A", // votes: a diverging yes/no ramp around 50 %
  population: "#3F6F8E",
  housing: "#8C6A3F",
  economy: "#4F7D4A",
  tourism: "#B0703A",
  trade: "#6D6F8C",
} as const;
export type LayerAccentKey = keyof typeof layerAccent;

/**
 * Sequential and diverging scale stops. Each entry is `[domainValue, hex]`.
 * Interpolation happens in Lab space (see `scales/`) so midpoints stay clean.
 */
export const scaleStops = {
  /** Air temperature in °C. Cool blues → neutral paper → warm sand → red. */
  temperature: [
    [-20, "#2F3E6B"],
    [-10, "#4A6FA5"],
    [0, "#8FB1CF"],
    [10, "#DADDE2"],
    [20, "#F5A623"],
    [30, "#E2563D"],
    [40, "#8A1F14"],
  ],
  /** Rain rate in mm/h. Transparent → blue → violet for extremes. */
  rainRate: [
    [0, "#3E6D9C00"],
    [0.5, "#9DBBD8"],
    [2, "#5C8FBF"],
    [10, "#2F5C8F"],
    [30, "#4A3C7A"],
    [100, "#2B1E4A"],
  ],
  /** Discharge relative to the seasonal normal (1 = normal). */
  dischargeRatio: [
    [0.25, "#A9C4D6"],
    [1, "#2F6F9F"],
    [2, "#1F4E75"],
    [4, "#E0742D"],
  ],
  /** Swiss flood / avalanche danger levels 1–5. */
  dangerLevel: [
    [1, "#8FB58A"],
    [2, "#E3D26F"],
    [3, "#E8A23A"],
    [4, "#D9552B"],
    [5, "#8E1B1B"],
  ],
  /** Share of yes votes in %, diverging around 50 (paper). */
  yesShare: [
    [20, "#8E1B1B"],
    [35, "#D9552B"],
    [45, "#E8C4A8"],
    [50, "#FAFAF8"],
    [55, "#BFC8D9"],
    [65, "#5F7FB5"],
    [80, "#2B2D6B"],
  ],
  /** Short-term air quality index 1 (good) … 6 (very poor). */
  airIndex: [
    [1, "#7FB59A"],
    [2, "#B9CF8E"],
    [3, "#E3D26F"],
    [4, "#E8A23A"],
    [5, "#D9552B"],
    [6, "#7A1B14"],
  ],
  /** Delay in seconds → grey to Swiss red. */
  delay: [
    [0, "#8B95A5"],
    [180, "#D9A08A"],
    [600, "#E2563D"],
    [1800, "#8A1F14"],
  ],
} as const satisfies Record<string, readonly (readonly [number, string])[]>;
export type ScaleStopsKey = keyof typeof scaleStops;
