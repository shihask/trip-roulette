"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type Town = {
  id: string;
  name: string;
  district: string;
  /** Lower-case, accent-free name and aliases, for matching. */
  search: string[];
  latitude: number;
  longitude: number;
};

export type Mood = { slug: string; name: string };

export type Catalogue =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; towns: Town[]; moods: Mood[] };

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Loads the curated starting towns and the mood taxonomy (direct reads under RLS).
 * Both lists are small and curated, so the whole list is loaded once and filtered locally;
 * that also gives geolocation the coordinates it needs.
 */
export function useCatalogue(): { catalogue: Catalogue; retry: () => void } {
  const [catalogue, setCatalogue] = useState<Catalogue>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    Promise.all([
      supabase
        .from("locations")
        .select("id, name, aliases, normalized_name, latitude, longitude, district:districts(name)")
        .eq("is_active", true)
        .order("name")
        .limit(500),
      supabase.from("categories").select("slug, name").eq("is_active", true).order("sort_order"),
    ])
      .then(([locs, cats]) => {
        if (cancelled) return;
        if (locs.error || cats.error || !locs.data || !cats.data) {
          setCatalogue({ status: "error" });
          return;
        }
        setCatalogue({
          status: "ready",
          towns: locs.data.map((l) => ({
            id: l.id,
            name: l.name,
            district: l.district?.name ?? "",
            search: [l.normalized_name, ...l.aliases].map(normalize),
            latitude: Number(l.latitude),
            longitude: Number(l.longitude),
          })),
          moods: cats.data,
        });
      })
      .catch(() => {
        if (!cancelled) setCatalogue({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setCatalogue({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  return { catalogue, retry };
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
