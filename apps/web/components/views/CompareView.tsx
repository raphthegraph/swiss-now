"use client";

import type { Figure } from "@swiss-now/core/topics";
import type { GeoRegister, LocalizedText } from "@swiss-now/core";
import { PlaceSearch, type PlacePick } from "../hud/PlaceSearch";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/lang";

export interface CompareSide {
  place: PlacePick | undefined;
  figures: Figure[];
}

/** COMPARE: two places side by side, the same figures for each. */
export function CompareView({
  register,
  a,
  b,
  onPickA,
  onPickB,
  title,
}: {
  register: GeoRegister | undefined;
  a: CompareSide;
  b: CompareSide;
  onPickA: (p: PlacePick) => void;
  onPickB: (p: PlacePick) => void;
  title: string;
}) {
  const { t, l } = useT();
  const rows = new Map<string, { label: LocalizedText; a?: Figure; b?: Figure }>();
  for (const f of a.figures) rows.set(f.id, { label: f.label, a: f });
  for (const f of b.figures) rows.set(f.id, { ...(rows.get(f.id) ?? { label: f.label }), b: f });
  const show = (f: Figure | undefined) =>
    f
      ? `${f.text ?? formatNumber(f.value, f.decimals)}${f.unit && !f.text ? ` ${f.unit}` : ""}`
      : "—";
  return (
    <section className="charts-view compare-view" aria-label={t("compare")}>
      <header className="charts__header">
        <h2 className="charts__title">{title}</h2>
        <p className="charts__meta label">{t("twoPlaces")}</p>
      </header>
      <div className="compare__pickers">
        <PlaceSearch register={register} value={a.place} onPick={onPickA} label="A" autoFocusKey />
        <PlaceSearch register={register} value={b.place} onPick={onPickB} label="B" />
      </div>
      <table className="compare__table">
        <thead>
          <tr>
            <th />
            <th>{a.place?.name ?? "A"}</th>
            <th>{b.place?.name ?? "B"}</th>
          </tr>
        </thead>
        <tbody>
          {[...rows.entries()].map(([id, r]) => (
            <tr key={id}>
              <th className="label">{l(r.label)}</th>
              <td className="tnum">
                {show(r.a)}
                {r.a?.where ? <div className="where">{r.a.where}</div> : null}
              </td>
              <td className="tnum">
                {show(r.b)}
                {r.b?.where ? <div className="where">{r.b.where}</div> : null}
              </td>
            </tr>
          ))}
          {!rows.size ? (
            <tr>
              <td colSpan={3} className="label">
                {t("pickTwo")}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
