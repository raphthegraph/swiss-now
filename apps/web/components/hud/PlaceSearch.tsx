"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoRegister } from "@swiss-now/core";
import { useT } from "@/lib/i18n/lang";

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
  const { t } = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const listId = `place-${label}-list`;
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
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && options[active]
            ? `${listId}-${options[active].kind}-${options[active].key}`
            : undefined
        }
        value={open ? q : (value?.name ?? q)}
        placeholder={t("municipalityOrCanton")}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !options.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(options.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            const o = options[active];
            if (!o) return;
            e.preventDefault();
            onPick(o);
            setQ("");
            setOpen(false);
          } else if (e.key === "Escape") setOpen(false);
        }}
        autoComplete="off"
      />
      {open && options.length ? (
        <ul className="place-search__list" role="listbox" id={listId}>
          {options.map((o, i) => (
            <li key={`${o.kind}-${o.key}`}>
              <button
                type="button"
                id={`${listId}-${o.kind}-${o.key}`}
                role="option"
                aria-selected={i === active}
                className="place-search__option"
                data-active={i === active ? "true" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onPick(o);
                  setQ("");
                  setOpen(false);
                }}
              >
                {o.name}{" "}
                <span className="label">{o.kind === "canton" ? t("canton") : o.canton}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
