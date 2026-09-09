"use client";

import type { EnergyState } from "@swiss-now/core";
import { PLANT_TYPE } from "@swiss-now/core/i18n";
import { plantType } from "@swiss-now/motion/tokens";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

const ORDER = [
  "hydro-storage",
  "hydro-pumped",
  "hydro-run",
  "nuclear",
  "solar",
  "wind",
  "biomass",
  "waste",
  "gas",
] as const;
const REGIONS = ["wallis", "graubuenden", "tessin", "uebrig"] as const;

/** Plant types by colour, the grid, and the storage lakes per region. */
export function EnergyLegend({ energy }: { energy: EnergyState | undefined }) {
  const { t, l } = useT();
  const r = energy?.reservoir;
  return (
    <div className="legend legend--energy">
      <div className="legend__row">
        {ORDER.map((k) => (
          <span className="legend__item" key={k}>
            <span className="legend__swatch" style={{ background: plantType[k] }} />
            {l(PLANT_TYPE[k])}
          </span>
        ))}
        <span className="legend__item">
          <span className="legend__grid" /> {t("energy.grid")}
        </span>
        <span className="legend__item label">{t("energy.sizeIsPower")}</span>
      </div>
      {r ? (
        <div className="legend__row legend__reservoirs">
          <span className="label">{t("energy.reservoirs")}</span>
          {REGIONS.map((k) => {
            const v = r.regions[k];
            if (!v) return null;
            const pct = v.maxGwh > 0 ? (v.gwh / v.maxGwh) * 100 : 0;
            return (
              <span
                className="reservoir"
                key={k}
                title={`${formatNumber(v.gwh, 0)} / ${formatNumber(v.maxGwh, 0)} GWh`}
              >
                <span className="reservoir__bar">
                  <span className="reservoir__fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="reservoir__label tnum">
                  {t(`energy.region.${k}`)} {formatNumber(pct, 0)} %
                </span>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
