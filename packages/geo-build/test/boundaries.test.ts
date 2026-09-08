import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const geo = join(__dirname, "../../../apps/web/public/geo");
const topo = JSON.parse(readFileSync(join(geo, "ch-2026.topo.json"), "utf8"));
const register = JSON.parse(readFileSync(join(geo, "municipalities-2026.json"), "utf8"));

describe("geo spine 2026", () => {
  it("has the four objects with ids that join to the register", () => {
    expect(Object.keys(topo.objects).sort()).toEqual([
      "cantons",
      "districts",
      "lakes",
      "municipalities",
    ]);
    expect(topo.objects.cantons.geometries).toHaveLength(26);
    expect(topo.objects.districts.geometries.length).toBeGreaterThan(100);
    expect(topo.objects.municipalities.geometries.length).toBeGreaterThan(2000);
    const ids = new Set(topo.objects.municipalities.geometries.map((g: { id: number }) => g.id));
    for (const m of register.municipalities) expect(ids.has(m.bfs)).toBe(true);
    expect(topo.objects.cantons.geometries.map((g: { id: string }) => g.id)).toContain("ZH");
    expect(topo.properties.attribution).toBe("© swisstopo");
    expect(topo.transform).toBeDefined(); // quantized, delta-encoded
  });
  it("keeps the register consistent", () => {
    expect(register.vintage).toBe(2026);
    expect(register.municipalities.length).toBeGreaterThan(2000);
    const zurich = register.municipalities.find((m: { bfs: number }) => m.bfs === 261);
    expect(zurich).toMatchObject({ name: "Zürich", canton: "ZH" });
    expect(Object.keys(register.cantons)).toHaveLength(26);
  });
});
