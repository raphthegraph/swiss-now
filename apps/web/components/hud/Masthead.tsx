"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { duration } from "@swiss-now/motion/tokens";
import type { Freshness } from "@swiss-now/core";
import { formatTime } from "@/lib/format";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface MastheadProps {
  home?: ReactNode;
  /** Live topics show the observation clock; statistics topics pass a vintage line instead. */
  clock?: { observedAt: string; freshness: Freshness } | undefined;
  status?: ReactNode;
}

/** Wordmark, home place and the clock — the only permanent chrome above the map. */
export function Masthead({ home, clock, status }: MastheadProps) {
  return (
    <motion.header
      className="hud hud--top"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.layerSwitch / 1000, ease: EASE }}
    >
      <h1>Swiss Now</h1>
      {home}
      {status ??
        (clock ? (
          <span className="label tnum">
            Switzerland · {formatTime(clock.observedAt)} ·{" "}
            <span className="freshness" data-state={clock.freshness}>
              {clock.freshness}
            </span>
          </span>
        ) : null)}
    </motion.header>
  );
}
