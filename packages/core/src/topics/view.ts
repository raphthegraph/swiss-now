/**
 * The view state that lives in the URL: `?topic=politics&mode=map&t=2026-06-14&place=261`.
 * Category and visualization mode are independent; `t` is a time key (snapshot slot, vintage,
 * month or vote id) and `place` a BFS number or canton code (`a,b` in COMPARE).
 */
import { Mode, TopicId } from "./spec";
import { TOPICS } from "./registry";
import { accessForSources } from "../sources/policy";

export interface ViewState {
  topic: TopicId;
  mode: Mode;
  t?: string;
  place?: string;
}

export const DEFAULT_VIEW: ViewState = { topic: "now", mode: "map" };

const KEY = /^[A-Za-z0-9:_.,-]{1,64}$/;

type ParamsLike = { get(name: string): string | null } | Record<string, string | undefined>;
function read(params: ParamsLike, name: string): string | undefined {
  const v = "get" in params && typeof params.get === "function" ? params.get(name) : undefined;
  if (v !== undefined) return v ?? undefined;
  return (params as Record<string, string | undefined>)[name];
}

/** Invalid values fall back to defaults; a mode the topic does not support falls back to `map`. */
export function parseViewState(params: ParamsLike): ViewState {
  const topicRaw = read(params, "topic");
  const topic = TopicId.safeParse(topicRaw ?? "now");
  // built topics only, and never one the licence policy blocks (e.g. aviation until an agreement)
  const id: TopicId =
    topic.success &&
    TOPICS[topic.data].built &&
    accessForSources(TOPICS[topic.data].sources) !== "blocked"
      ? topic.data
      : "now";
  const modeRaw = Mode.safeParse(read(params, "mode") ?? "map");
  const mode = modeRaw.success && TOPICS[id].modes.includes(modeRaw.data) ? modeRaw.data : "map";
  const out: ViewState = { topic: id, mode };
  const t = read(params, "t");
  if (t && KEY.test(t)) out.t = t;
  const place = read(params, "place");
  if (place && KEY.test(place)) out.place = place;
  return out;
}

/** Query string without the leading `?`; defaults are omitted so `/` stays canonical. */
export function serializeViewState(v: ViewState): string {
  const p = new URLSearchParams();
  if (v.topic !== "now") p.set("topic", v.topic);
  if (v.mode !== "map") p.set("mode", v.mode);
  if (v.t) p.set("t", v.t);
  if (v.place) p.set("place", v.place);
  return p.toString();
}

/** Switching topic keeps the mode when supported, else falls back to MAP; time and place reset. */
export function switchTopic(v: ViewState, topic: TopicId): ViewState {
  const mode = TOPICS[topic].modes.includes(v.mode) ? v.mode : "map";
  return { topic, mode };
}
