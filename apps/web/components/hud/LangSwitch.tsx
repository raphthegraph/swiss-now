"use client";

import { UI_LANGS } from "@swiss-now/core/i18n";
import { useLang, useT } from "@/lib/i18n/lang";

/** Four letters in the colophon; the choice is stored in the browser and mirrored on `<html lang>`. */
export function LangSwitch() {
  const { lang, setLang } = useLang();
  const { t } = useT();
  return (
    <span className="lang" role="group" aria-label={t("language")}>
      {UI_LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className="lang__item"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
