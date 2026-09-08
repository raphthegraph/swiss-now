"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LocalizedText } from "@swiss-now/core/state";
import { isUiLang, pick, type UiLang } from "@swiss-now/core/i18n";
import { MotionConfig } from "motion/react";
import { STRINGS, type StringKey } from "./strings";

const KEY = "swiss-now:lang";

interface LangContextValue {
  lang: UiLang;
  setLang: (lang: UiLang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: "en", setLang: () => {} });

/** `?lang=` wins, then the stored choice, then the browser language, then English. */
function detect(): UiLang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (isUiLang(q)) return q;
    const stored = window.localStorage.getItem(KEY);
    if (isUiLang(stored)) return stored;
    const nav = navigator.language.slice(0, 2).toLowerCase();
    if (isUiLang(nav)) return nav;
  } catch {
    // no storage or no window
  }
  return "en";
}

/**
 * Interface language. The server and the first client render use English so hydration matches;
 * the effect then applies the detected language and mirrors it on `<html lang>`.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("en");
  useEffect(() => {
    setLangState(detect());
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((next: UiLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(KEY, next);
      const url = new URL(window.location.href);
      if (url.searchParams.has("lang")) {
        url.searchParams.set("lang", next);
        window.history.replaceState(null, "", url.toString());
      }
    } catch {
      // storage unavailable; the choice still applies for this session
    }
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return (
    <LangContext.Provider value={value}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/** Interpolates `{name}` placeholders. */
function fill(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;
export type Localize = (text: LocalizedText | string | undefined) => string;

/** `t("key", { n: 3 })` for interface strings; `l(text)` for localized data text. */
export function useT(): { t: Translate; l: Localize; lang: UiLang } {
  const { lang } = useLang();
  return useMemo(
    () => ({
      lang,
      t: (key, vars) => fill(pick(STRINGS[key], lang), vars),
      l: (text) => pick(text, lang),
    }),
    [lang],
  );
}
