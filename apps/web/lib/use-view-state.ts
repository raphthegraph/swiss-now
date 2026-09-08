"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseViewState,
  serializeViewState,
  switchTopic,
  type Mode,
  type TopicId,
  type ViewState,
} from "@swiss-now/core/topics";

/**
 * The view (topic, mode, time, place) lives in the URL so every view is a deep link. Mode and
 * time changes replace the entry; topic changes push one so Back returns to the previous topic.
 * Next syncs `useSearchParams` with `history.pushState`/`replaceState`, so no navigation happens.
 */
export function useViewState() {
  const params = useSearchParams();
  const view = useMemo(() => parseViewState(params), [params]);
  const write = useCallback((next: ViewState, push: boolean) => {
    const q = serializeViewState(next);
    const url = `${window.location.pathname}${q ? `?${q}` : ""}`;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);
  const setTopic = useCallback(
    (topic: TopicId) => write(switchTopic(view, topic), true),
    [view, write],
  );
  const setMode = useCallback((mode: Mode) => write({ ...view, mode }, false), [view, write]);
  const setTime = useCallback(
    (t: string | undefined) => {
      const next: ViewState = { topic: view.topic, mode: view.mode };
      if (t) next.t = t;
      if (view.place) next.place = view.place;
      write(next, false);
    },
    [view, write],
  );
  const setPlace = useCallback(
    (place: string | undefined) => {
      const next: ViewState = { topic: view.topic, mode: view.mode };
      if (view.t) next.t = view.t;
      if (place) next.place = place;
      write(next, false);
    },
    [view, write],
  );
  return { view, setTopic, setMode, setTime, setPlace };
}
