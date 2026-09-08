import { describe, expect, it } from "vitest";
import { EVENT_CATEGORY, FL, LOCALE, UI_LANGS, isUiLang, pick, t, withSuffix } from "../src/i18n";
import { TOPICS, TOPIC_GROUPS } from "../src/topics/registry";
import { figuresFor } from "../src/topics/figures";
import type { EnergyState } from "../src/state/layers";

describe("i18n", () => {
  it("offers the three national languages and English, with a locale each", () => {
    expect(UI_LANGS).toEqual(["de", "fr", "it", "en"]);
    for (const l of UI_LANGS) expect(LOCALE[l]).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    expect(isUiLang("rm")).toBe(false);
    expect(isUiLang("fr")).toBe(true);
  });
  it("picks the language and falls back to English, then German", () => {
    const x = t("Wärmster Ort", "Warmest", "Le plus chaud", "Il più caldo");
    expect(pick(x, "fr")).toBe("Le plus chaud");
    expect(pick({ de: "Nur Deutsch" }, "it")).toBe("Nur Deutsch");
    expect(pick({ de: "D", en: "E" }, "fr")).toBe("E");
    expect(pick("plain", "de")).toBe("plain");
    expect(pick(undefined, "de")).toBe("");
  });
  it("every shared figure label, topic label and event category carries all four languages", () => {
    const all = [
      ...Object.values(FL),
      ...Object.values(EVENT_CATEGORY).flatMap((c) => [c.one, c.many]),
      ...Object.values(TOPICS).map((s) => s.label),
      ...TOPIC_GROUPS.map((g) => g.label),
    ];
    for (const x of all) for (const l of UI_LANGS) expect(x[l], JSON.stringify(x)).toBeTruthy();
  });
  it("suffixes every language", () => {
    const s = withSuffix(
      { de: "Bevölkerung", en: "Population" },
      t(", Schweiz", ", Switzerland", ", Suisse", ", Svizzera"),
    );
    expect(s.fr).toBe("Population, Suisse");
    expect(s.de).toBe("Bevölkerung, Schweiz");
  });
  it("figures carry localized labels", () => {
    const energy: EnergyState = {
      layer: "energy",
      observedAt: "2026-09-08T10:00:00Z",
      freshness: "live",
      borderFlows: { DE: 100, FR: 20 },
      netImportMW: 120,
      frequencyHz: 50.01,
    } as unknown as EnergyState;
    const f = figuresFor("energy", { energy });
    const net = f.find((x) => x.id === "net-flow")!;
    expect(pick(net.label, "it")).toBe("Importazione netta");
    expect(pick(net.label, "en")).toBe("Net import");
  });
});
