/**
 * spin (DATABASE_API_SPEC §8.5, ARCHITECTURE §6).
 * The server picks the winner: uniform over the three recommendations with Web Crypto rejection
 * sampling. One result per trip (unique constraint); a repeated or concurrent request returns the
 * stored result whatever key it sent. Generates the default itinerary in the same call.
 * Deployed with verify_jwt off: the caller's token is verified here with Supabase Auth.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped nested selects from supabase-js */
import { createClient } from "@supabase/supabase-js";
import { clientIp, errorResponse, json, sha256Hex, serve } from "../_shared/http.ts";
import { RNG_NAME, uniformIndex } from "../_shared/rng.ts";
import { generateAndStoreItinerary } from "../_shared/trip-itinerary.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  return keys.default ?? Object.values(keys)[0];
}

const admin = createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOW_SECONDS = 600;
const USER_LIMIT = 30;
const IP_LIMIT = 90;

type StoredResult = {
  result_id: string;
  recommendation_id: string;
  selection_index: number;
  public_code: string;
  created_at: string;
};

async function respond(result: StoredResult, status: 200 | 201) {
  const { data: rec } = await admin
    .from("trip_recommendations")
    .select("destination:destinations(slug)")
    .eq("id", result.recommendation_id)
    .single();
  return json(
    {
      resultId: result.result_id,
      publicCode: result.public_code,
      recommendationId: result.recommendation_id,
      // deno-lint-ignore no-explicit-any
      destinationSlug: (rec?.destination as any)?.slug ?? null,
      index: result.selection_index,
      probability: 0.3333,
      createdAt: result.created_at,
    },
    status,
  );
}

async function ensureItinerary(tripId: string, recommendationId: string) {
  const { count } = await admin.from("trip_itinerary_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  if ((count ?? 0) > 0) return;
  try {
    await generateAndStoreItinerary(admin, tripId, recommendationId);
  } catch (err) {
    // The spin stands even if the itinerary fails; the destination page can regenerate it.
    console.error(`spin: itinerary failed for ${tripId}`, err instanceof Error ? err.message : err);
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);

  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: null, error: true };
    const user = auth?.user;
    if (authError || !user) return errorResponse("UNAUTHORIZED", "Please start a guest session and try again.", requestId);

    const key = req.headers.get("idempotency-key") ?? "";
    if (!UUID.test(key)) return errorResponse("IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key header (UUID) is required.", requestId);

    const body = await req.json().catch(() => null);
    const tripId = typeof body?.tripId === "string" ? body.tripId : "";
    if (!UUID.test(tripId)) {
      return errorResponse("VALIDATION_ERROR", "Please check the request.", requestId, { fieldErrors: { tripId: "A valid trip ID is required." } });
    }

    const ipHash = await sha256Hex(`spin:${clientIp(req)}`);
    const [byUser, byIp] = await Promise.all([
      admin.rpc("rate_limit_hit", { p_bucket: `spin:user:${user.id}`, p_window_seconds: WINDOW_SECONDS, p_limit: USER_LIMIT }),
      admin.rpc("rate_limit_hit", { p_bucket: `spin:ip:${ipHash}`, p_window_seconds: WINDOW_SECONDS, p_limit: IP_LIMIT }),
    ]);
    if (byUser.error || byIp.error) throw new Error(`rate limit check failed: ${(byUser.error ?? byIp.error)?.message}`);
    if (byUser.data === false || byIp.data === false) {
      return errorResponse("RATE_LIMITED", "Too many requests. Wait a few minutes and try again.", requestId, {
        headers: { "Retry-After": String(WINDOW_SECONDS) },
      });
    }

    // Ownership: the trip must belong to the caller (same rule RLS enforces for reads).
    const { data: trip, error: tripError } = await admin
      .from("trips")
      .select("id, owner_user_id, status, expires_at")
      .eq("id", tripId)
      .maybeSingle();
    if (tripError) throw new Error(`trip read failed: ${tripError.message}`);
    if (!trip || trip.owner_user_id !== user.id) return errorResponse("TRIP_NOT_FOUND", "We can't find this trip.", requestId);

    // An existing result always wins, whatever key was sent.
    const { data: existing, error: existingError } = await admin
      .from("roulette_results")
      .select("id, recommendation_id, selection_index, public_code, created_at")
      .eq("trip_id", tripId)
      .maybeSingle();
    if (existingError) throw new Error(`result read failed: ${existingError.message}`);
    if (existing) {
      await ensureItinerary(tripId, existing.recommendation_id);
      return respond({ result_id: existing.id, ...existing }, 200);
    }

    if (trip.status === "expired" || new Date(trip.expires_at).getTime() < Date.now()) {
      return errorResponse("TRIP_EXPIRED", "This trip has expired. Start a new one.", requestId);
    }

    const { data: recs, error: recError } = await admin
      .from("trip_recommendations")
      .select("id, position, destination:destinations(publication_status)")
      .eq("trip_id", tripId)
      .order("position");
    if (recError) throw new Error(`recommendations read failed: ${recError.message}`);
    // deno-lint-ignore no-explicit-any
    if (!recs || recs.length !== 3 || recs.some((r) => (r.destination as any)?.publication_status !== "published")) {
      return errorResponse("TRIP_STALE", "One of your places is no longer available. Start a new trip.", requestId);
    }

    const index = uniformIndex(3);
    const chosen = recs[index];

    const { data: stored, error: spinError } = await admin.rpc("record_spin", {
      p_trip_id: tripId,
      p_recommendation_id: chosen.id,
      p_selection_index: index,
      p_idempotency_key: key,
      p_rng: RNG_NAME,
    });
    if (spinError) {
      if (spinError.code === "23505") {
        return errorResponse("VALIDATION_ERROR", "This Idempotency-Key was already used for another trip.", requestId);
      }
      throw new Error(`record_spin failed: ${spinError.message}`);
    }
    const row = (stored as (StoredResult & { inserted: boolean })[])[0];

    await ensureItinerary(tripId, row.recommendation_id);

    if (row.inserted) {
      const { error } = await admin.from("analytics_events").insert({
        event_type: "roulette_spin_completed",
        trip_id: tripId,
        metadata: { index: row.selection_index },
      });
      if (error) console.error("analytics insert failed", error.message);
    }

    return respond(row, row.inserted ? 201 : 200);
  } catch (err) {
    console.error(`spin ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong on our side. Please try again.", requestId);
  }
});
