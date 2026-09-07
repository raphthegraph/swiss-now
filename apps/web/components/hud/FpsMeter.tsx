"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Spike A instrument. Counts rendered frames per second via requestAnimationFrame
 * (what the user perceives), independent of MapLibre's own render events. Enabled with `?fps=1`.
 */
export function FpsMeter() {
  const [fps, setFps] = useState(0);
  const [min, setMin] = useState(Infinity);
  const frames = useRef(0);
  const last = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      frames.current += 1;
      if (now - last.current >= 1000) {
        const f = Math.round((frames.current * 1000) / (now - last.current));
        setFps(f);
        setMin((m) => Math.min(m, f));
        frames.current = 0;
        last.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fps tnum" data-testid="fps">
      {fps} fps <span className="fps__min">min {Number.isFinite(min) ? min : "–"}</span>
    </div>
  );
}
