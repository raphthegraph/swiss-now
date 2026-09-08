/** What the marks mean (docs/PRODUCT_VISION.md §4: interpolation is always labelled). */
export function RailLegend({ loaded, needed }: { loaded: number; needed: number }) {
  const loading = needed > 0 && loaded < needed * 0.9;
  return (
    <div className="legend" aria-label="Rail legend">
      <span className="legend__item">
        <span className="legend__train" /> train, position estimated from timetable + live delays
      </span>
      <span className="legend__item">
        <span className="legend__ring" /> delayed ≥ 3 min · ring grows with the delay
      </span>
      <span className="legend__item">
        <span className="legend__disruption" /> disruption between the named stations (SBB)
      </span>
      {loading ? (
        <span className="legend__item label">
          loading routes {loaded} / {needed}
        </span>
      ) : null}
    </div>
  );
}
