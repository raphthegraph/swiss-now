"use client";

/** Discrete timeline over an indicator's periods (years or months), newest on the right. */
export function PeriodScrubber({
  periods,
  selected,
  onChange,
  label,
}: {
  periods: string[];
  selected: string;
  onChange: (p: string) => void;
  label: string;
}) {
  if (periods.length < 2) return null;
  const index = Math.max(0, periods.indexOf(selected));
  return (
    <div className="scrubber scrubber--votes" role="group" aria-label={`${label} timeline`}>
      <button
        type="button"
        className="scrubber__play"
        onClick={() => onChange(periods[Math.max(0, index - 1)]!)}
        disabled={index === 0}
        aria-label="Previous period"
      >
        ←
      </button>
      <input
        className="scrubber__range"
        type="range"
        min={0}
        max={periods.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(periods[Number(e.target.value)]!)}
        aria-label="Period"
        aria-valuetext={periods[index]}
      />
      <span className="scrubber__time tnum">
        <span className="label">{label}</span> {periods[0]} – {periods[periods.length - 1]} ·{" "}
        <strong>{periods[index]}</strong>
      </span>
    </div>
  );
}
