/* eslint-disable @next/next/no-img-element -- a static brand asset, no optimisation needed */
/** The SWISS NOW wordmark (owner's artwork, public/brand/wordmark.png, transparent background). */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`wordmark ${className}`.trim()}
      src="/brand/wordmark.png"
      alt="Swiss Now"
      width={1200}
      height={181}
      decoding="async"
    />
  );
}
