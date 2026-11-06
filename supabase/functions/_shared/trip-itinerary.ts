/**
 * Builds and stores the itinerary for a spun trip from stored data only (ARCHITECTURE §8).
 * Used by `spin` (default itinerary) and later by `generate-itinerary` (custom departure time).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped nested selects from supabase-js */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildItinerary, type Itinerary } from "./itinerary.ts";
import { addDays, todayInKolkata, type DurationCode } from "./trip-request.ts";

export async function generateAndStoreItinerary(
  admin: SupabaseClient,
  tripId: string,
  recommendationId: string,
  departureLocalTime?: string,
): Promise<Itinerary> {
  const { data: trip, error: tripError } = await admin
    .from("trips")
    .select("duration_code, overnight_stay, travel_date, date_flexible, algorithm_version, start_location:locations(name)")
    .eq("id", tripId)
    .single();
  if (tripError || !trip) throw new Error(`itinerary: trip read failed: ${tripError?.message}`);

  const { data: rec, error: recError } = await admin
    .from("trip_recommendations")
    .select("route_snapshot, destination:destinations(id, name, latitude, longitude)")
    .eq("id", recommendationId)
    .eq("trip_id", tripId)
    .single();
  if (recError || !rec) throw new Error(`itinerary: recommendation read failed: ${recError?.message}`);

  // deno-lint-ignore no-explicit-any
  const dest = rec.destination as any;
  // deno-lint-ignore no-explicit-any
  const route = rec.route_snapshot as any;

  const [rule, config, attractions, closures] = await Promise.all([
    admin.from("duration_rules").select("nights").eq("duration_code", trip.duration_code).single(),
    admin.from("algorithm_configs").select("flexible_date_window_days").eq("version", trip.algorithm_version).single(),
    admin
      .from("attractions")
      .select("id, name, latitude, longitude, activity_duration_minutes, priority, opening_information, is_active")
      .eq("destination_id", dest.id)
      .eq("is_active", true),
    admin
      .from("access_information")
      .select("attraction_id, valid_from, valid_until")
      .eq("destination_id", dest.id)
      .eq("status", "closed")
      .not("attraction_id", "is", null),
  ]);
  for (const r of [rule, config, attractions, closures]) {
    if (r.error) throw new Error(`itinerary: data read failed: ${r.error.message}`);
  }

  // Attractions closed at any point in the trip window are left out (step 1).
  const start = trip.travel_date ?? todayInKolkata();
  const end = trip.travel_date ?? addDays(start, (config.data?.flexible_date_window_days ?? 14) - 1);
  const closed = new Set(
    (closures.data ?? [])
      .filter((c) => (c.valid_from === null || c.valid_from <= end) && (c.valid_until === null || c.valid_until >= start))
      .map((c) => c.attraction_id as string),
  );

  const itinerary = buildItinerary({
    // deno-lint-ignore no-explicit-any
    startName: (trip.start_location as any)?.name ?? "your starting point",
    destinationName: dest.name,
    destination: { latitude: Number(dest.latitude), longitude: Number(dest.longitude) },
    routeMinutes: Number(route.durationMinutes),
    duration: trip.duration_code as DurationCode,
    nights: rule.data!.nights,
    overnightStay: trip.overnight_stay,
    departureLocalTime,
    attractions: (attractions.data ?? [])
      .filter((a) => !closed.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        latitude: a.latitude === null ? null : Number(a.latitude),
        longitude: a.longitude === null ? null : Number(a.longitude),
        activityDurationMinutes: a.activity_duration_minutes,
        priority: a.priority,
        hasVerifiedOpeningHours: a.opening_information !== null,
      })),
  });

  const { error: saveError } = await admin.rpc("replace_trip_itinerary", { p_trip_id: tripId, p_items: itinerary.items });
  if (saveError) throw new Error(`itinerary: save failed: ${saveError.message}`);
  return itinerary;
}
