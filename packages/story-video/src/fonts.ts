import { loadFont } from "@remotion/google-fonts/Inter";

// The house grotesk (first candidate in @swiss-now/motion's fontFamily token). Loading it here
// keeps renders and the web Player consistent regardless of what the host page has loaded.
export const inter = loadFont("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
});
