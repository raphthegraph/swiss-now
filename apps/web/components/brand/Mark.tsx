/* eslint-disable @next/next/no-img-element -- a static brand asset, no optimisation needed */
/**
 * The contour mark (owner's artwork, public/brand/mark.png): Switzerland's border as nested
 * lines around a red dot. A generated SVG twin lives in public/brand/mark.svg for the video.
 */
export function Mark({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      className={`mark ${className}`.trim()}
      src="/brand/mark.png"
      alt=""
      width={size}
      height={size}
      decoding="async"
      aria-hidden="true"
    />
  );
}
