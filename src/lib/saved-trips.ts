"use client";

import { useSyncExternalStore } from "react";

/**
 * Saved trips (BUILD_BRIEF §6, FR-08): kept only in this browser's localStorage, so they survive
 * restarts and can be read offline. Nothing is sent to the server. Each entry is a self-contained
 * copy of what the trip page shows.
 */

export type SavedTrip = {
  tripId: string;
  savedAt: string;
  publicCode: string;
  destination: { slug: string; name: string; district: string; type: string };
  startTown: string;
  dateLabel: string;
  durationLabel: string;
  travellerCount: number;
  transportLabel: string;
  cost: {
    perPerson: { amountMinor: number | null; minMinor: number | null; maxMinor: number | null };
    lines: { label: string; minMinor: number; maxMinor: number }[];
    notIncluded: string[];
  };
  itinerary: { day: number; sequence: number; title: string; startLocal: string | null; endLocal: string | null }[];
  accessLastVerifiedAt: string | null;
};

const KEY = "tr.saved.v1";
const EVENT = "tr:saved-trips";
const MAX = 50;
const EMPTY: SavedTrip[] = [];

let cache: { raw: string | null; value: SavedTrip[] } = { raw: null, value: EMPTY };

function read(): SavedTrip[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.value;
  let value: SavedTrip[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    value = Array.isArray(parsed) ? parsed.filter((t) => t && typeof t.tripId === "string" && t.destination?.name) : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function write(list: SavedTrip[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, cb);
  };
}

/** Saved trips, newest first. The server render (and storage-blocked browsers) see an empty list. */
export function useSavedTrips(): SavedTrip[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** True once mounted in the browser (saved state is only known client-side). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Returns false if the browser blocks storage. */
export function saveTrip(trip: SavedTrip): boolean {
  return write([trip, ...read().filter((t) => t.tripId !== trip.tripId)]);
}

/** Updates an already-saved trip in place (e.g. after the itinerary changed). No-op if not saved or unchanged. */
export function refreshSavedTrip(trip: Omit<SavedTrip, "savedAt">): void {
  const list = read();
  const i = list.findIndex((t) => t.tripId === trip.tripId);
  if (i < 0) return;
  const next = { ...trip, savedAt: list[i].savedAt };
  if (JSON.stringify(next) === JSON.stringify(list[i])) return;
  write(list.map((t, j) => (j === i ? next : t)));
}

export function removeSavedTrip(tripId: string): boolean {
  return write(read().filter((t) => t.tripId !== tripId));
}
