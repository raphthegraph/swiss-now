import { Composition } from "remotion";
import { PlateSpike } from "./spike/PlateSpike";

export const RemotionRoot = () => (
  <>
    {/* Spike B: proves the shared style, tokens, scales and primitives render in the video target. */}
    <Composition
      id="SwissNowPlateSpike"
      component={PlateSpike}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ title: "Switzerland right now" }}
    />
  </>
);
