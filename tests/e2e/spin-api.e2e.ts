import { expect, test } from "@playwright/test";
import { supabase } from "./helpers";

/**
 * Spin service (BUILD_BRIEF §10): a repeated idempotency key and concurrent requests both return
 * the single stored result; clients can't write a winner. Creates one guest and one trip.
 * (Index mapping and uniformity are unit-tested with an injected RNG in tests/unit/spin.test.ts.)
 */
test("spin is idempotent and one result per trip under concurrency", async ({ request }) => {
  const headers = { apikey: supabase.key, "Content-Type": "application/json" };
  const signup = await (await request.post(`${supabase.url}/auth/v1/signup`, { headers, data: {} })).json();
  const auth = { ...headers, Authorization: `Bearer ${signup.access_token}` };

  const [kochi] = await (await request.get(`${supabase.url}/rest/v1/locations?select=id&name=eq.Kochi`, { headers: auth })).json();
  const created = await request.post(`${supabase.url}/functions/v1/create-trip`, {
    headers: auth,
    data: {
      startLocationId: kochi.id, travelDate: null, dateFlexible: true, duration: "one_day", budgetPerPersonMinor: 200000,
      currency: "INR", travellerCount: 2, travelGroup: "friends", moods: ["nature"], transportMode: "car",
      overnightStay: null, accessibilityNeeds: [],
    },
  });
  expect(created.status()).toBe(201);
  const trip = await created.json();
  expect(trip.recommendations).toHaveLength(3);
  expect(JSON.stringify(trip)).not.toMatch(/matchScore|match_score/);

  const spin = (key?: string) =>
    request.post(`${supabase.url}/functions/v1/spin`, {
      headers: key ? { ...auth, "Idempotency-Key": key } : auth,
      data: { tripId: trip.tripId },
    });

  expect((await spin()).status()).toBe(400); // IDEMPOTENCY_KEY_REQUIRED

  const keys = Array.from({ length: 5 }, () => crypto.randomUUID());
  const responses = await Promise.all(keys.map((k) => spin(k)));
  const bodies = await Promise.all(responses.map((r) => r.json()));
  expect(new Set(bodies.map((b) => b.resultId)).size).toBe(1);
  expect(responses.map((r) => r.status()).filter((s) => s === 201)).toHaveLength(1);

  const first = bodies[0];
  expect(trip.recommendations[first.index].recommendationId).toBe(first.recommendationId);
  expect(first.publicCode).toMatch(/^TR-[0-9A-Z]{6}$/);

  const repeat = await spin(keys[0]);
  expect(repeat.status()).toBe(200);
  expect((await repeat.json()).resultId).toBe(first.resultId);

  const insert = await request.post(`${supabase.url}/rest/v1/roulette_results`, {
    headers: auth,
    data: { trip_id: trip.tripId, recommendation_id: first.recommendationId, selection_index: 0, idempotency_key: crypto.randomUUID(), public_code: "TR-AAAAAA", rng: "client" },
  });
  expect([401, 403]).toContain(insert.status());
});
