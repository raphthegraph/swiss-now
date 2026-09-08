/** SWISS NOW: bold and light in the brand face (docs/DESIGN.md). Reads as one word to assistive tech. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`.trim()} aria-label="Swiss Now">
      <span className="wordmark__heavy" aria-hidden="true">
        SWISS
      </span>
      <span className="wordmark__light" aria-hidden="true">
        NOW
      </span>
    </span>
  );
}
