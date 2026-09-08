import type { EventCategory } from "../../state/events";

const RULES: [RegExp, EventCategory][] = [
  [/lawine/i, "avalanche"],
  [/unfall|unfälle|kollision|verunfallt|rega|personenrettung/i, "accident"],
  [/brand|brände|feuer(?!wehr)|explosion/i, "fire"],
  [
    /hochwasser|unwetter|sturm|erdrutsch|murgang|naturkatastroph|überschwemm|felssturz|waldbrand/i,
    "natural-hazard",
  ],
  [/raub|einbruch|diebstahl|betrug|drogen|gewalt|tötung|festnahme|kriminal/i, "crime"],
];

/** Category from feed categories first, then from the headline; police feeds default to police. */
export function categorize(
  title: string,
  categories: string[],
  fallback: EventCategory,
): EventCategory {
  const hay = `${categories.join(" ")} ${title}`;
  for (const [re, cat] of RULES) if (re.test(hay)) return cat;
  return fallback;
}
