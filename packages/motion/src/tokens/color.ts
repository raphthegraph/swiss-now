/**
 * Colour tokens. Swiss modernism: a near-monochrome ground, one accent per layer,
 * colour reserved for information. Hex values are sRGB.
 */
export const ground = {
  /** Warm off-white paper for the day ground. */
  paper: "#F4F3EF",
  /** Near-black ink for type and the night ground. */
  ink: "#111214",
  /** Mid-grey for secondary type and hairlines. */
  graphite: "#5C6068",
  /** Light hairline / disabled. */
  mist: "#C9CBCF",
  /** Water body fill on the basemap. */
  lake: "#D9E2EA",
  /** Relief hillshade tint (multiplied over the ground). */
  relief: "#B9B6AE",
} as const;

/** Environmental grounds derived from sun altitude over Bern (see `daylight`). */
export const daylightGround = {
  dawn: { background: "#E9E4DC", foreground: "#1B1C1F", basemapOpacity: 0.9 },
  day: { background: "#F4F3EF", foreground: "#111214", basemapOpacity: 1 },
  dusk: { background: "#2A2C33", foreground: "#EDEBE6", basemapOpacity: 0.75 },
  night: { background: "#0F1114", foreground: "#E6E4DF", basemapOpacity: 0.6 },
} as const;

/** One accent per layer. Used sparingly; the map ground stays monochrome. */
export const layerAccent = {
  weather: "#D9552B", // warm orange-red for temperature extremes and the layer label
  rain: "#3E6D9C", // radar / precipitation
  wind: "#7B8794", // particles are near-neutral so they read as motion, not colour
  hydrology: "#2F6F9F",
  rail: "#8A8F98", // trains are neutral grey…
  railDelay: "#E30613", // …Swiss red is reserved for delay
  traffic: "#D89A1E",
  air: "#7A6E8C",
  energy: "#9AA83A",
  seismic: "#E0742D",
} as const;
export type LayerAccentKey = keyof typeof layerAccent;

/**
 * Sequential and diverging scale stops. Each entry is `[domainValue, hex]`.
 * Interpolation happens in Lab space (see `scales/`) so midpoints stay clean.
 */
export const scaleStops = {
  /** Air temperature in °C. Cool blues → neutral paper → warm sand → red. */
  temperature: [
    [-20, "#2B2D6B"],
    [-10, "#3F5FA8"],
    [0, "#7FA3C9"],
    [10, "#D8D6CC"],
    [20, "#E8B76E"],
    [30, "#D9552B"],
    [40, "#7A1B14"],
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
  /** Delay in seconds → grey to Swiss red. */
  delay: [
    [0, "#8A8F98"],
    [180, "#B98A73"],
    [600, "#E30613"],
    [1800, "#8E0A11"],
  ],
} as const satisfies Record<string, readonly (readonly [number, string])[]>;
export type ScaleStopsKey = keyof typeof scaleStops;
