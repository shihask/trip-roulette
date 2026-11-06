import type { CostSnapshot } from "@shared/cost";
import type { Warning } from "@shared/engine";
import type { DurationCode, TransportMode, TravelGroup } from "@shared/trip-request";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { connection } from "next/server";

export type TripRecommendationView = {
  id: string;
  position: number;
  matchReason: string;
  warnings: Warning[];
  route: { distanceKm: number; durationMinutes: number };
  cost: CostSnapshot;
  lastVerifiedAt: string;
  destination: { slug: string; name: string; type: string; district: string; imageAlt: string };
};

export type SpinResultView = { resultId: string; recommendationId: string; index: number; publicCode: string };

export type TripView = {
  id: string;
  status: "recommended" | "spun" | "expired";
  expired: boolean;
  hasSpin: boolean;
  spin: SpinResultView | null;
  startLocation: string;
  startCoords: { latitude: number; longitude: number } | null;
  travelDate: string | null;
  dateFlexible: boolean;
  duration: DurationCode;
  budgetPerPersonMinor: number;
  travellerCount: number;
  travelGroup: TravelGroup;
  moods: { slug: string; name: string }[];
  transportMode: TransportMode;
  recommendations: TripRecommendationView[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads a trip and its stored recommendations under RLS (DATABASE_API_SPEC §8.4).
 * Returns null when the trip doesn't exist or belongs to someone else (RLS hides it).
 * Never recomputes anything.
 */
export async function getTrip(tripId: string): Promise<TripView | null> {
  if (!UUID.test(tripId)) return null;
  // Expiry is checked against the current time: always render this at request time.
  await connection();
  const supabase = await getSupabaseServerClient();

  // No session means no trips: anon has no read access to trip tables at all.
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;

  const [{ data: trip, error }, { data: categories }] = await Promise.all([
    supabase
      .from("trips")
      .select(
        `id, status, expires_at, travel_date, date_flexible, duration_code, budget_per_person_minor,
         traveller_count, travel_group, moods, transport_mode,
         start_location:locations(name, latitude, longitude),
         trip_recommendations(id, position, match_reason, warnings, route_snapshot, cost_snapshot, access_snapshot,
           destination:destinations(slug, name, destination_type, district:districts(name),
             destination_images(alt_text, is_primary))),
         roulette_results(id, recommendation_id, selection_index, public_code)`,
      )
      .eq("id", tripId)
      .maybeSingle(),
    supabase.from("categories").select("slug, name"),
  ]);

  if (error?.code === "42501") return null; // permission denied: not this visitor's trip
  if (error) throw new Error(`Trip read failed: ${error.message}`);
  if (!trip) return null;

  const names = new Map((categories ?? []).map((c) => [c.slug, c.name]));
  // One-to-one (trip_id is unique), so PostgREST may return an object, null, or a 0/1-item array.
  type SpinRow = { id: string; recommendation_id: string; selection_index: number; public_code: string };
  const rawSpin = trip.roulette_results as unknown as SpinRow | SpinRow[] | null;
  const spinRow = Array.isArray(rawSpin) ? (rawSpin[0] ?? null) : rawSpin;

  return {
    id: trip.id,
    status: trip.status,
    expired: trip.status === "expired" || new Date(trip.expires_at).getTime() < Date.now(),
    hasSpin: spinRow !== null,
    spin: spinRow
      ? { resultId: spinRow.id, recommendationId: spinRow.recommendation_id, index: spinRow.selection_index, publicCode: spinRow.public_code }
      : null,
    startLocation: trip.start_location?.name ?? "",
    startCoords: trip.start_location
      ? { latitude: Number(trip.start_location.latitude), longitude: Number(trip.start_location.longitude) }
      : null,
    travelDate: trip.travel_date,
    dateFlexible: trip.date_flexible,
    duration: trip.duration_code,
    budgetPerPersonMinor: Number(trip.budget_per_person_minor),
    travellerCount: trip.traveller_count,
    travelGroup: trip.travel_group,
    moods: trip.moods.map((slug) => ({ slug, name: names.get(slug) ?? slug })),
    transportMode: trip.transport_mode,
    recommendations: [...trip.trip_recommendations]
      .sort((a, b) => a.position - b.position)
      .map((r) => {
        const route = r.route_snapshot as { distanceKm: number; durationMinutes: number };
        const access = r.access_snapshot as { lastVerifiedAt: string };
        const images = r.destination?.destination_images ?? [];
        const image = images.find((i) => i.is_primary) ?? images[0];
        return {
          id: r.id,
          position: r.position,
          matchReason: r.match_reason,
          warnings: (r.warnings as Warning[]) ?? [],
          route: { distanceKm: Number(route.distanceKm), durationMinutes: Number(route.durationMinutes) },
          cost: r.cost_snapshot as unknown as CostSnapshot,
          lastVerifiedAt: access.lastVerifiedAt,
          destination: {
            slug: r.destination?.slug ?? "",
            name: r.destination?.name ?? "This destination",
            type: r.destination?.destination_type ?? "",
            district: r.destination?.district?.name ?? "",
            imageAlt: image?.alt_text ?? "",
          },
        };
      }),
  };
}

export type ItineraryItemView = {
  day: number;
  sequence: number;
  kind: "travel" | "attraction" | "meal" | "rest" | "return";
  title: string;
  startLocal: string | null;
  endLocal: string | null;
  notes: string | null;
};

/** The stored itinerary for a trip, under RLS. Empty when none exists (or not this visitor's trip). */
export async function getTripItinerary(tripId: string): Promise<ItineraryItemView[]> {
  if (!UUID.test(tripId)) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("trip_itinerary_items")
    .select("day, sequence, kind, title, start_local, end_local, notes")
    .eq("trip_id", tripId)
    .order("day")
    .order("sequence");
  if (error?.code === "42501") return [];
  if (error) throw new Error(`Itinerary read failed: ${error.message}`);
  return data.map((i) => ({
    day: i.day,
    sequence: i.sequence,
    kind: i.kind,
    title: i.title,
    startLocal: i.start_local,
    endLocal: i.end_local,
    notes: i.notes,
  }));
}
