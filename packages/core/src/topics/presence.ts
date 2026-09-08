import type { LayerId } from "../state/common";
import { TOPICS, TOPIC_ORDER } from "./registry";
import type { TopicId } from "./spec";

/** How a layer renders: the selected topic's own layers in full, NOW contributors quietly. */
export type Presence = "full" | "quiet" | "off";

/** The built topic that owns a layer (first non-NOW topic rendering it). */
export function ownerOf(layer: LayerId): TopicId | undefined {
  return TOPIC_ORDER.find(
    (id) => id !== "now" && TOPICS[id].built && TOPICS[id].layerIds.includes(layer),
  );
}

export function presenceFor(topic: TopicId, layer: LayerId): Presence {
  if (topic !== "now") return TOPICS[topic].layerIds.includes(layer) ? "full" : "off";
  const owner = ownerOf(layer);
  return owner && TOPICS[owner].now ? "quiet" : "off";
}

/** Layers a topic needs loaded at all (its own plus, in NOW, every quiet contributor). */
export function layersNeeded(topic: TopicId): LayerId[] {
  const all = new Set<LayerId>();
  for (const id of TOPIC_ORDER) for (const l of TOPICS[id].layerIds) all.add(l);
  return [...all].filter((l) => presenceFor(topic, l) !== "off");
}
