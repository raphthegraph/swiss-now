/** Energy state assembly: Swissgrid flows and frequency plus Energy-Charts mix and price. */
import type { EnergyState } from "../../state/layers";
import { computeFreshness, worstFreshness } from "../../freshness/index";
import type { BorderFlows, FrequencySample } from "../swissgrid/index";
import { latestGeneration, type GenerationSeries } from "../energy-charts/index";

export interface EnergyInputs {
  reservoir?: import("../../state/energy-sites").ReservoirState | undefined;
  flows?: BorderFlows | undefined;
  frequency?: FrequencySample | undefined;
  generation?: GenerationSeries | undefined;
  price?: { eurPerMWh: number; hour: string; validUntil?: string } | undefined;
}

export function buildEnergyState(inputs: EnergyInputs, now = new Date()): EnergyState {
  const updatedAt = now.toISOString();
  const flowsAt = inputs.flows?.observedAt;
  const latest = inputs.generation ? latestGeneration(inputs.generation) : undefined;
  const state: EnergyState = {
    schemaVersion: 1,
    updatedAt,
    observedAt: flowsAt ?? inputs.frequency?.observedAt ?? latest?.observedAt ?? updatedAt,
    // flows: minute cadence with a 20-minute publication delay; mix: hourly with ~3 h lag
    freshness: worstFreshness([
      computeFreshness(flowsAt, 60, 20 * 60, now),
      latest ? computeFreshness(latest.observedAt, 3600, 3 * 3600, now) : "outage",
    ]),
    sources: ["swissgrid-live", "energy-charts"],
    borderFlows: inputs.flows?.flows ?? {},
  };
  if (inputs.flows?.netImportMW !== undefined) state.netImportMW = inputs.flows.netImportMW;
  if (flowsAt) state.flowsObservedAt = flowsAt;
  if (inputs.frequency) {
    state.frequencyHz = inputs.frequency.hz;
    state.frequencyObservedAt = inputs.frequency.observedAt;
    if (inputs.frequency.gridTimeDeviationS !== undefined)
      state.gridTimeDeviationS = inputs.frequency.gridTimeDeviationS;
  }
  if (latest) {
    state.generation = { observedAt: latest.observedAt, byTypeMW: latest.byTypeMW };
    if (latest.renewableSharePct !== undefined)
      state.generation.renewableSharePct = latest.renewableSharePct;
  }
  if (inputs.reservoir) {
    state.reservoir = inputs.reservoir;
    if (!state.sources.includes("sfoe-reservoirs")) state.sources.push("sfoe-reservoirs");
  }
  if (inputs.generation)
    state.generationSeries = {
      unixSeconds: inputs.generation.unixSeconds,
      byTypeMW: inputs.generation.byTypeMW,
    };
  if (inputs.price) {
    state.price = { eurPerMWh: inputs.price.eurPerMWh, hour: inputs.price.hour };
    if (inputs.price.validUntil) state.price.validUntil = inputs.price.validUntil;
  }
  return state;
}
