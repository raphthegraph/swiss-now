import { Config } from "@remotion/cli/config";

// WebGL maps need a GPU-backed context in headless Chromium (Remotion maps skill).
Config.setChromiumOpenGlRenderer("angle");
Config.setConcurrency(1);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
