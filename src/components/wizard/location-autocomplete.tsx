"use client";

import { forwardRef, useId, useMemo, useState, type KeyboardEvent } from "react";
import type { SelectedLocation } from "./wizard-state";
import { distanceKm, normalize, type Town } from "./use-catalogue";
import { CheckCircle } from "./fields";

/** Within this distance, "Use my location" selects the nearest town; further away, the user confirms. */
const NEAR_KM = 40;

type Geo =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "far"; town: Town; km: number }
  | { kind: "near"; town: Town; km: number };

function toSelected(t: Town): SelectedLocation {
  return { id: t.id, name: t.name, district: t.district };
}

export const LocationAutocomplete = forwardRef<
  HTMLInputElement,
  {
    towns: Town[];
    value: SelectedLocation | null;
    onChange: (value: SelectedLocation | null) => void;
    error?: string;
    errorId: string;
  }
>(function LocationAutocomplete({ towns, value, onChange, error, errorId }, inputRef) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [geo, setGeo] = useState<Geo>({ kind: "idle" });
  const listId = useId();
  const hintId = useId();
  const statusId = useId();

  const matches = useMemo(() => {
    const q = normalize(query);
    if (!q || (value && query === value.name)) return towns;
    return towns
      .filter((t) => t.search.some((s) => s.includes(q)))
      .sort((a, b) => Number(b.search.some((s) => s.startsWith(q))) - Number(a.search.some((s) => s.startsWith(q))));
  }, [query, towns, value]);

  function select(t: Town) {
    onChange(toSelected(t));
    setQuery(t.name);
    setOpen(false);
    setActive(-1);
    setGeo({ kind: "idle" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (matches.length ? (i + 1) % matches.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (matches.length ? (i <= 0 ? matches.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && matches[active]) {
        e.preventDefault();
        select(matches[active]);
      } else if (open && matches.length === 1) {
        e.preventDefault();
        select(matches[0]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeo({ kind: "unavailable" });
      return;
    }
    setGeo({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best: { town: Town; km: number } | null = null;
        for (const t of towns) {
          const km = distanceKm(latitude, longitude, t.latitude, t.longitude);
          if (!best || km < best.km) best = { town: t, km };
        }
        if (!best) {
          setGeo({ kind: "unavailable" });
          return;
        }
        const km = Math.round(best.km);
        if (best.km <= NEAR_KM) {
          onChange(toSelected(best.town));
          setQuery(best.town.name);
          setOpen(false);
          setGeo({ kind: "near", town: best.town, km });
        } else {
          setGeo({ kind: "far", town: best.town, km });
        }
      },
      (err) => setGeo({ kind: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }

  const showList = open && matches.length > 0;
  const noMatch = open && matches.length === 0 && query.trim() !== "";
  const activeId = showList && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <div className="flex flex-col gap-3" data-field="startLocationId">
      <label htmlFor={`${listId}-input`} className="text-base font-semibold">
        Starting town
      </label>
      <p id={hintId} className="-mt-2 text-sm text-muted">
        Type to search. We currently plan trips from {towns.length} towns in Kerala.
      </p>
      <div className="relative">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-describedby={`${hintId} ${statusId}${error ? ` ${errorId}` : ""}`}
          aria-invalid={error ? true : undefined}
          placeholder="e.g. Kochi or Calicut"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            setActive(-1);
            if (value && next !== value.name) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={`h-14 w-full rounded-control border-[1.5px] bg-surface pl-12 pr-4 text-[17px] ${
            error ? "border-error-inline" : "border-line-input"
          }`}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Supported starting towns"
          hidden={!showList}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-auto rounded-control border border-line bg-surface py-1.5 shadow-lg"
        >
          {matches.map((t, i) => (
            <li
              key={t.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(t)}
              className={`flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2 ${i === active ? "bg-green-tint" : "hover:bg-ground"}`}
            >
              <span className="text-base font-semibold">{t.name}</span>
              <span className="text-sm text-muted">{t.district} district</span>
            </li>
          ))}
        </ul>
      </div>

      <p id={statusId} aria-live="polite" className="sr-only">
        {showList ? `${matches.length} ${matches.length === 1 ? "town" : "towns"} found. Use the arrow keys to choose.` : ""}
        {noMatch ? "No supported town matches." : ""}
      </p>

      {noMatch ? (
        <p className="text-[15px] text-muted">
          No supported town matches “{query.trim()}”. We currently start trips from{" "}
          {towns.map((t) => t.name).join(", ")}.
        </p>
      ) : null}

      {value && query === value.name ? (
        <p className="flex items-center gap-2 text-[15px] font-medium text-green-ink">
          <CheckCircle />
          Starting from {value.name}, {value.district} district
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={locateMe}
          disabled={geo.kind === "locating"}
          className="inline-flex h-12 items-center gap-2 self-start rounded-control border-[1.5px] border-line-strong bg-surface px-4 text-[15px] font-semibold disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="M9 1.5v3M9 13.5v3M1.5 9h3M13.5 9h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          {geo.kind === "locating" ? "Finding your location…" : "Use my location"}
        </button>
        <p className="text-sm text-muted">
          Your location is only used in this browser to find the nearest supported town. It isn&apos;t saved.
        </p>
        <div aria-live="polite">
          {geo.kind === "near" ? (
            <p className="text-[15px]">
              Using {geo.town.name}, the nearest town we support (about {geo.km} km from you).
            </p>
          ) : null}
          {geo.kind === "far" ? (
            <div className="flex flex-col gap-2 rounded-control border border-warn-border bg-warn-bg p-3.5 text-[15px] text-warn-text">
              <p>
                The nearest town we support is {geo.town.name}, about {geo.km} km from you. Trips are
                planned from the town you choose.
              </p>
              <button
                type="button"
                onClick={() => select(geo.town)}
                className="inline-flex h-11 items-center self-start rounded-control bg-surface px-4 font-semibold text-ink"
              >
                Start from {geo.town.name}
              </button>
            </div>
          ) : null}
          {geo.kind === "denied" ? (
            <p className="text-[15px]">
              Location access is off for this site. Search for your town above instead.
            </p>
          ) : null}
          {geo.kind === "unavailable" ? (
            <p className="text-[15px]">We couldn&apos;t get your location. Search for your town above instead.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
});
