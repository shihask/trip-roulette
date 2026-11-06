/**
 * Shared-trip snapshot (DATABASE_API_SPEC §8.8). Frozen when the link is created.
 * Included: destination name, district, type, primary image; start town; travel date; duration;
 * traveller count; transport mode; per-person estimate and included items; itinerary; oldest
 * essential-access verification date.
 * Excluded by construction: user identifiers, the budget entered, moods, trip ID.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SharedTripSnapshot = {
  version: 1;
  destination: { slug: string; name: string; district: string; type: string; image: { alt: string; credit: string } | null };
  startTown: string;
  travelDate: string | null;
  dateFlexible: boolean;
  durationLabel: string;
  travellerCount: number;
  transportMode: "car" | "bike" | "public_transport";
  cost: {
    perPerson: { amountMinor: number | null; minMinor: number | null; maxMinor: number | null; currency: "INR" };
    included: string[];
    notIncluded: string[];
    isEstimate: true;
  };
  itinerary: { day: number; sequence: number; kind: string; title: string; startLocal: string | null; endLocal: string | null }[];
  accessLastVerifiedAt: string | null;
  createdAt: string;
};

/** 256 random bits, base64url (43 characters). Only ever returned once, in the create response. */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped nested selects from supabase-js */
/** Builds the snapshot from stored data. Throws "SPIN_REQUIRED" if the trip hasn't been spun. */
export async function buildSnapshot(admin: SupabaseClient, tripId: string): Promise<SharedTripSnapshot> {
  const { data: trip, error } = await admin
    .from("trips")
    .select(
      `travel_date, date_flexible, duration_code, traveller_count, transport_mode,
       start_location:locations(name),
       roulette_results(recommendation_id)`,
    )
    .eq("id", tripId)
    .single();
  if (error || !trip) throw new Error(`share: trip read failed: ${error?.message}`);

  const spin = Array.isArray(trip.roulette_results) ? trip.roulette_results[0] : (trip.roulette_results as any);
  if (!spin) throw new Error("SPIN_REQUIRED");

  const [rec, rule, items] = await Promise.all([
    admin
      .from("trip_recommendations")
      .select(
        `cost_snapshot, access_snapshot,
         destination:destinations(slug, name, destination_type, district:districts(name),
           destination_images(alt_text, credit, is_primary, sort_order))`,
      )
      .eq("id", spin.recommendation_id)
      .single(),
    admin.from("duration_rules").select("label").eq("duration_code", trip.duration_code).single(),
    admin
      .from("trip_itinerary_items")
      .select("day, sequence, kind, title, start_local, end_local")
      .eq("trip_id", tripId)
      .order("day")
      .order("sequence"),
  ]);
  for (const r of [rec, rule, items]) if (r.error) throw new Error(`share: read failed: ${r.error.message}`);

  const d = rec.data!.destination as any;
  const cost = rec.data!.cost_snapshot as any;
  const access = rec.data!.access_snapshot as any;
  const images = [...(d.destination_images ?? [])].sort(
    (a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );

  return {
    version: 1,
    destination: {
      slug: d.slug,
      name: d.name,
      district: d.district?.name ?? "",
      type: d.destination_type,
      image: images[0] ? { alt: images[0].alt_text, credit: images[0].credit } : null,
    },
    startTown: (trip.start_location as any)?.name ?? "",
    travelDate: trip.travel_date,
    dateFlexible: trip.date_flexible,
    durationLabel: rule.data!.label,
    travellerCount: trip.traveller_count,
    transportMode: trip.transport_mode,
    cost: {
      perPerson: cost.perPerson,
      included: (cost.lines ?? []).map((l: any) => l.label),
      notIncluded: cost.notIncluded ?? [],
      isEstimate: true,
    },
    itinerary: (items.data ?? []).map((i: any) => ({
      day: i.day,
      sequence: i.sequence,
      kind: i.kind,
      title: i.title,
      startLocal: i.start_local,
      endLocal: i.end_local,
    })),
    accessLastVerifiedAt: access?.lastVerifiedAt ?? null,
    createdAt: new Date().toISOString(),
  };
}
