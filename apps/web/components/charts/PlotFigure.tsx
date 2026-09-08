"use client";

import { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";
import { fontFamily, ground } from "@swiss-now/motion/tokens";

/**
 * Observable Plot in the house style: paper ground, ink type, hairlines, no chart chrome beyond
 * what the data needs. Re-renders when the options change; the SVG is inserted into the figure.
 */
export function PlotFigure({
  options,
  title,
  className,
}: {
  options: Plot.PlotOptions;
  title?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const plot = Plot.plot({
      ...options,
      style: {
        fontFamily: fontFamily.sans,
        fontSize: "12px",
        background: "transparent",
        color: ground.ink,
        ...(options.style as object),
      },
    });
    // with a legend Plot returns a <figure> wrapping the legend and the chart
    const svg =
      plot.tagName.toLowerCase() === "svg" ? plot : plot.querySelector("svg:last-of-type");
    svg?.classList.add("plot");
    if (title && svg) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
      t.textContent = title;
      svg.prepend(t);
    }
    el.replaceChildren(plot);
    return () => plot.remove();
  }, [options, title]);
  return <figure ref={ref} className={`plot-figure${className ? ` ${className}` : ""}`} />;
}
