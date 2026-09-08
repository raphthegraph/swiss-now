"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoRegister } from "@swiss-now/core";

export interface PlacePick {
  key: string;
  name: string;
  kind: "municipality" | "canton";
  canton: string;
  lonLat?: [number, number] | undefined;
}

/** Typeahead over the register: 2 100 municipalities and the 26 cantons; `/` focuses the first search. */
export function PlaceSearch({
  register,
  value,
  onPick,
  label,
  autoFocusKey,
}: {
  register: GeoRegister | undefined;
  value: PlacePick | undefined;
  onPick: (p: PlacePick) => void;
  label: string;
  autoFocusKey?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const options = useMemo(() => {
    if (!register || q.trim().length < 2) return [];
    const needle = q.trim().toLowerCase();
    const cantons: PlacePick[] = Object.entries(register.cantons)
      .filter(([code, c]) => c.name.toLowerCase().includes(needle) || code.toLowerCase() === needle)
      .map(([code, c]) => ({
        key: code,
        name: c.name,
        kind: "canton",
        canton: code,
        lonLat: c.lonLat,
      }));
    const munis: PlacePick[] = register.municipalities
      .filter((m) => m.name.toLowerCase().includes(needle))
      .slice(0, 8)
      .map((m) => ({
        key: String(m.bfs),
        name: m.name,
        kind: "municipality",
        canton: m.canton,
        lonLat: m.lonLat,
      }));
    return [...cantons, ...munis].slice(0, 10);
  }, [register, q]);
  useEffect(() => {
    if (!autoFocusKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoFocusKey]);
  return (
    <div className="place-search">
      <label className="label" htmlFor={`place-${label}`}>
        {label}
      </label>
      <input
        id={`place-${label}`}
        ref={ref}
        className="place-search__input"
        value={open ? q : (value?.name ?? q)}
        placeholder="Municipality or canton"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && options.length ? (
        <ul className="place-search__list" role="listbox">
          {options.map((o) => (
            <li key={`${o.kind}-${o.key}`}>
              <button
                type="button"
                className="place-search__option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(o);
                  setQ("");
                  setOpen(false);
                }}
              >
                {o.name} <span className="label">{o.kind === "canton" ? "canton" : o.canton}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
