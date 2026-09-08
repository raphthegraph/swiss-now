import { MARK_DOT, MARK_DOT_R, MARK_PATHS, MARK_STROKE, MARK_VIEWBOX } from "@/lib/brand/mark";

/** The contour mark: Switzerland's border as nested lines around a red dot; strokes in currentColor. */
export function Mark({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={MARK_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {MARK_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <circle cx={MARK_DOT[0]} cy={MARK_DOT[1]} r={MARK_DOT_R} fill="var(--sn-brand-swiss-red)" />
    </svg>
  );
}
