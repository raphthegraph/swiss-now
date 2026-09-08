import { brand, ground, layerAccent, daylightGround } from "./color";
import { fontFamily, typeScale } from "./type";
import { space, hudMargin, radius, shadow } from "./space";
import { duration, cssEasing } from "./motion";

/**
 * Flattens the tokens into CSS custom properties for the web app.
 * Remotion consumes the TypeScript objects directly.
 */
export function toCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(ground)) vars[`--sn-ground-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(layerAccent)) vars[`--sn-accent-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(brand)) vars[`--sn-brand-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(radius)) vars[`--sn-radius-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(shadow)) vars[`--sn-shadow-${k}`] = v;
  for (const [state, g] of Object.entries(daylightGround)) {
    vars[`--sn-daylight-${state}-bg`] = g.background;
    vars[`--sn-daylight-${state}-fg`] = g.foreground;
  }
  vars["--sn-font-sans"] = fontFamily.sans;
  vars["--sn-font-brand"] = fontFamily.brand;
  vars["--sn-font-mono"] = fontFamily.mono;
  for (const [k, t] of Object.entries(typeScale)) {
    vars[`--sn-type-${kebab(k)}-size`] = `${t.size}px`;
    vars[`--sn-type-${kebab(k)}-lh`] = String(t.lineHeight);
    vars[`--sn-type-${kebab(k)}-tracking`] = `${t.tracking}em`;
  }
  for (const [k, v] of Object.entries(space)) vars[`--sn-space-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(hudMargin)) vars[`--sn-hud-margin-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(duration)) vars[`--sn-duration-${kebab(k)}`] = `${v}ms`;
  for (const [k, v] of Object.entries(cssEasing)) vars[`--sn-ease-${k}`] = v;
  return vars;
}

/** Renders the variables as a `:root { … }` block. */
export function cssVariablesBlock(selector = ":root"): string {
  const body = Object.entries(toCssVariables())
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}\n`;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
