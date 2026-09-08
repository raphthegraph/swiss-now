/**
 * @swiss-now/story-video — the "Switzerland Today" Remotion composition.
 * Lives in a package (not in apps/video) so the web app can mount it in a Remotion <Player>
 * without importing the video app; apps/video registers it as a composition and renders it.
 */
export * from "./timeline";
export * from "./SwitzerlandToday";
export { chapterAccent, chapterCredit } from "./chapter-style";
