"use client";

import { LAYER_RAIL, type ActiveLayer } from "@/lib/layers";

/** Typographic layer rail (docs/PRODUCT_VISION.md §5.2). Selecting a layer reduces the composite to that system. */
export function LayerRail({
  active,
  onChange,
}: {
  active: ActiveLayer;
  onChange: (l: ActiveLayer) => void;
}) {
  return (
    <nav className="hud hud--rail" aria-label="Layers">
      <ul>
        {LAYER_RAIL.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className="rail__item"
              aria-current={active === l.id ? "true" : undefined}
              onClick={() => onChange(l.id)}
            >
              {l.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
