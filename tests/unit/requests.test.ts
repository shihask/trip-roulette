import { describe, expect, it } from "vitest";
import { trackEventRequestSchema } from "../../supabase/functions/_shared/analytics.ts";
import { DEPARTURE_CHOICES, generateItineraryRequestSchema } from "../../supabase/functions/_shared/itinerary-request.ts";

const tripId = "70000000-0000-4000-8000-000000000001";

describe("generate-itinerary request", () => {
  it("accepts a departure time in range, or none", () => {
    expect(generateItineraryRequestSchema.safeParse({ tripId, departureLocalTime: "06:30" }).success).toBe(true);
    expect(generateItineraryRequestSchema.safeParse({ tripId, departureLocalTime: "04:00" }).success).toBe(true);
    expect(generateItineraryRequestSchema.safeParse({ tripId, departureLocalTime: "14:00" }).success).toBe(true);
    expect(generateItineraryRequestSchema.safeParse({ tripId }).success).toBe(true);
    expect(generateItineraryRequestSchema.safeParse({ tripId, departureLocalTime: null }).success).toBe(true);
  });

  it("rejects malformed or out-of-range times and bad trip IDs", () => {
    for (const t of ["6:30", "03:59", "14:01", "24:00", "06:60", "noon", ""]) {
      expect(generateItineraryRequestSchema.safeParse({ tripId, departureLocalTime: t }).success, t).toBe(false);
    }
    expect(generateItineraryRequestSchema.safeParse({ tripId: "x", departureLocalTime: "06:00" }).success).toBe(false);
  });

  it("offers half-hour choices from 05:00 to 12:00, all accepted by the schema", () => {
    expect(DEPARTURE_CHOICES[0]).toBe("05:00");
    expect(DEPARTURE_CHOICES.at(-1)).toBe("12:00");
    expect(DEPARTURE_CHOICES).toHaveLength(15);
    for (const t of DEPARTURE_CHOICES) expect(generateItineraryRequestSchema.safeParse({ tripId, departureLocalTime: t }).success).toBe(true);
  });
});

describe("track-event request", () => {
  const ok = (body: unknown) => trackEventRequestSchema.safeParse(body).success;

  it("accepts allow-listed browser events with allowed metadata", () => {
    expect(ok({ eventType: "homepage_view" })).toBe(true);
    expect(ok({ eventType: "start_trip_clicked", metadata: { from: "explore" } })).toBe(true);
    expect(ok({ eventType: "destination_viewed", tripId, anonymousId: crypto.randomUUID(), metadata: { source: "trip", slug: "munnar" } })).toBe(true);
    expect(
      ok({
        eventType: "preferences_completed",
        metadata: { duration: "one_day", transport: "car", travel_group: "friends", mood_count: 2, flexible_date: false },
      }),
    ).toBe(true);
  });

  it("rejects server-side and unknown events", () => {
    for (const e of ["roulette_spin_completed", "recommendations_generated", "trip_shared", "itinerary_generated", "page_view"]) {
      expect(ok({ eventType: e }), e).toBe(false);
    }
  });

  it("rejects unknown metadata keys, free text and location", () => {
    expect(ok({ eventType: "homepage_view", metadata: { town: "Kochi" } })).toBe(false);
    expect(ok({ eventType: "start_trip_clicked", metadata: { from: "/destinations/munnar?ref=x" } })).toBe(false);
    expect(ok({ eventType: "destination_viewed", metadata: { source: "trip", slug: "Munnar Hills!" } })).toBe(false);
    expect(ok({ eventType: "destination_viewed", metadata: { source: "trip", latitude: 10.1 } })).toBe(false);
    expect(ok({ eventType: "homepage_view", extra: true })).toBe(false);
    expect(ok({ eventType: "homepage_view", anonymousId: "not-a-uuid" })).toBe(false);
  });
});
