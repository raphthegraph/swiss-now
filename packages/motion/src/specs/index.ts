/**
 * Scene/camera specs shared by the web "Today" mode and the Remotion compositions.
 * The types live in @swiss-now/core (StorySpec, Chapter, CameraSpec); this module adds helpers.
 */
import type { CameraSpec } from "@swiss-now/core";
import { lerp } from "../math/easing.js";

/** Whole-country framing used as the resting camera and as the story's opening shot. */
export const SWITZERLAND_CAMERA: CameraSpec = {
  center: [8.2275, 46.8182],
  zoom: 7.2,
  bearing: 0,
  pitch: 0,
};

/** Bounding box of Switzerland (WGS84) for fit calculations. */
export const SWITZERLAND_BBOX: readonly [number, number, number, number] = [
  5.956, 45.818, 10.492, 47.808,
];

/** Interpolates two cameras; `t` should already be eased. Bearing takes the shortest arc. */
export function interpolateCamera(a: CameraSpec, b: CameraSpec, t: number): CameraSpec {
  let db = b.bearing - a.bearing;
  if (db > 180) db -= 360;
  if (db < -180) db += 360;
  return {
    center: [lerp(a.center[0], b.center[0], t), lerp(a.center[1], b.center[1], t)],
    zoom: lerp(a.zoom, b.zoom, t),
    bearing: (a.bearing + db * t + 360) % 360,
    pitch: lerp(a.pitch, b.pitch, t),
  };
}

/** Frames per second used by the video compositions; chapters convert `durationHint` with it. */
export const VIDEO_FPS = 30;

export function secondsToFrames(seconds: number, fps = VIDEO_FPS): number {
  return Math.round(seconds * fps);
}
