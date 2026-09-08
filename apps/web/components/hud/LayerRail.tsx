"use client";

import { motion } from "motion/react";
import { LAYER_RAIL, type ActiveLayer } from "@/lib/layers";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Typographic layer rail (docs/PRODUCT_VISION.md §5.2). Selecting a layer reduces the composite to that system. */
export function LayerRail({
  active,
  onChange,
  hidden = [],
}: {
  active: ActiveLayer;
  onChange: (l: ActiveLayer) => void;
  /** layers that stay out of the rail until they have something to show (QUAKES) */
  hidden?: ActiveLayer[];
}) {
  return (
    <nav className="hud hud--rail" aria-label="Layers">
      <ul>
        {LAYER_RAIL.filter((l) => !hidden.includes(l.id)).map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className="rail__item"
              aria-current={active === l.id ? "true" : undefined}
              onClick={() => onChange(l.id)}
            >
              {active === l.id ? (
                <motion.span
                  className="rail__indicator"
                  layoutId="rail-indicator"
                  transition={{ duration: 0.24, ease: EASE }}
                />
              ) : null}
              {l.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
