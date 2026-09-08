/**
 * Figures at a past moment, from a stored 10-minute snapshot (the TIMELINE mode of live topics).
 * Full weather and water states are stored; the other layers keep summaries, so their figures
 * are a subset of the live ones.
 */
import { FL } from "../i18n";
import type { LocalizedText } from "../state/common";
import type { Snapshot } from "../snapshot/index";
import type { TopicId } from "./spec";
import { quakeFigures, waterFigures, weatherFigures, type Figure } from "./figures";

const fig = (
  id: string,
  label: LocalizedText,
  value: number,
  decimals: number,
  rest: { unit?: string; text?: string; where?: string } = {},
): Figure => {
  const f: Figure = { id, label, value, decimals };
  if (rest.unit !== undefined) f.unit = rest.unit;
  if (rest.text !== undefined) f.text = rest.text;
  if (rest.where !== undefined) f.where = rest.where;
  return f;
};

export function railSummaryFigures(r: Snapshot["rail"]): Figure[] {
  if (!r) return [];
  const out: Figure[] = [
    fig("running", FL.trainsRunning, r.running, 0, { where: "at snapshot time" }),
  ];
  if (r.onTimeIndex !== undefined)
    out.push(
      fig("on-time", FL.onTime, r.onTimeIndex * 100, 0, {
        unit: "%",
        where: "< 3 min at the last stop passed",
      }),
    );
  const worst = r.worst[0];
  if (worst && worst.delaySeconds >= 180)
    out.push(
      fig("largest-delay", FL.largestDelay, worst.delaySeconds / 60, 0, {
        unit: "min",
        where: `${worst.line} → ${worst.headsign ?? ""}`.trim(),
      }),
    );
  if (r.disruptions.length)
    out.push(
      fig("disruptions", FL.disruptions, r.disruptions.length, 0, {
        unit: r.disruptions.length === 1 ? "section" : "sections",
      }),
    );
  return out;
}

export function figuresForSnapshot(topic: TopicId, s: Snapshot, nowMs: number): Figure[] {
  switch (topic) {
    case "weather":
      return weatherFigures(s.weather);
    case "water":
      return waterFigures(s.hydrology);
    case "rail":
      return railSummaryFigures(s.rail);
    case "hazards": {
      const out: Figure[] = [];
      const h = s.hazards;
      if (h?.fireMaxLevel)
        out.push(
          fig("fire", FL.fireDanger, h.fireMaxLevel, 0, {
            text: `level ${h.fireMaxLevel}`,
            where: `${h.fireRegionsAt3Plus} regions at 3 or more`,
          }),
        );
      if (h?.hail)
        out.push(fig("hail", FL.hail, 1, 0, { text: "detected", where: "MeteoSwiss radar" }));
      return [...out, ...quakeFigures(s.seismic, nowMs).slice(0, 2)];
    }
    case "energy": {
      const e = s.energy;
      if (!e) return [];
      const out: Figure[] = [];
      if (e.netImportMW !== undefined)
        out.push(
          fig(
            "net-flow",
            e.netImportMW >= 0 ? FL.netImport : FL.netExport,
            Math.abs(e.netImportMW),
            0,
            { unit: "MW", where: "Swissgrid, 20 min delayed" },
          ),
        );
      if (e.frequencyHz !== undefined)
        out.push(fig("frequency", FL.gridFrequency, e.frequencyHz, 3, { unit: "Hz" }));
      if (e.priceEurPerMWh !== undefined)
        out.push(fig("price", FL.dayAheadPrice, e.priceEurPerMWh, 0, { unit: "€/MWh" }));
      if (e.renewableSharePct !== undefined)
        out.push(fig("renewable", FL.renewableShare, e.renewableSharePct, 0, { unit: "%" }));
      return out;
    }
    case "events": {
      const ev = s.events;
      if (!ev) return [];
      return [
        fig("events", FL.eventsInWindow, ev.count, 0, {
          where: `${ev.placed} placed with high confidence`,
        }),
      ];
    }
    case "air": {
      const a = s.air;
      if (!a) return [];
      const out: Figure[] = [];
      if (a.worstIndex !== undefined)
        out.push(
          fig("air-index", FL.airQuality, a.worstIndex, 0, {
            text: String(a.worstIndex),
            where: `${a.referenceStations} reference stations`,
          }),
        );
      out.push(fig("citizen", FL.citizenSensors, a.citizenSensors, 0));
      return out;
    }
    case "now":
      return [
        ...weatherFigures(s.weather).slice(0, 2),
        ...railSummaryFigures(s.rail).filter((f) => f.id === "on-time"),
        ...waterFigures(s.hydrology).slice(0, 1),
      ];
    default:
      return [];
  }
}
