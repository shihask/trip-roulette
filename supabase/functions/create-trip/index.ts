/**
 * create-trip (DATABASE_API_SPEC §8.3, ARCHITECTURE §5).
 * Validates the request, runs the engine on published data, and stores the trip with exactly three
 * recommendations in one transaction. Returns 201 with the three, or 422 INSUFFICIENT_DESTINATIONS.
 * Deployed with verify_jwt off: the caller's token is verified here with Supabase Auth.
 */
import { createClient } from "@supabase/supabase-js";
import { recommend, type Recommendation } from "../_shared/engine.ts";
import { clientIp, errorResponse, json, sha256Hex, serve } from "../_shared/http.ts";
import { loadCatalogue } from "../_shared/load-catalogue.ts";
import { createTripRequestSchema, toFieldErrors, type CreateTripRequest } from "../_shared/trip-request.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  return keys.default ?? Object.values(keys)[0];
}

const admin = createClient(SUPABASE_URL, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Rate limits (ARCHITECTURE §11.4): per user and per IP, fixed 10-minute windows. Assumptions. */
const WINDOW_SECONDS = 600;
const USER_LIMIT = 20;
const IP_LIMIT = 60;

function insufficientMessage(count: number): string {
  if (count === 0) return "No places fit all of that yet.";
  if (count === 1) return "Only one place fits all of that.";
  return "Only two places fit all of that.";
}

function toResponseItem(rec: Recommendation, recommendationId: string) {
  const d = rec.destination;
  return {
    recommendationId,
    position: rec.position,
    destination: {
      slug: d.slug,
      name: d.name,
      district: d.district,
      type: d.destinationType,
      image: d.image ? { url: d.image.externalUrl, alt: d.image.alt, credit: d.image.credit } : null,
    },
    route: { distanceKm: rec.route.distanceKm, durationMinutes: rec.route.durationMinutes, isEstimate: true },
    costPerPerson: { ...rec.cost.perPerson, isEstimate: true },
    matchReason: rec.matchReason,
    access: { lastVerifiedAt: rec.access.lastVerifiedAt },
    warnings: rec.warnings,
  };
}

async function track(eventType: string, tripId: string | null, metadata: Record<string, unknown>) {
  const { error } = await admin.from("analytics_events").insert({ event_type: eventType, trip_id: tripId, metadata });
  if (error) console.error("analytics insert failed", error.message);
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);

  try {
    // 1. Caller (anonymous or permanent user).
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: null, error: true };
    const user = auth?.user;
    if (authError || !user) return errorResponse("UNAUTHORIZED", "Please start a guest session and try again.", requestId);

    // 2. Rate limits.
    const ipHash = await sha256Hex(`create-trip:${clientIp(req)}`);
    const [byUser, byIp] = await Promise.all([
      admin.rpc("rate_limit_hit", { p_bucket: `create-trip:user:${user.id}`, p_window_seconds: WINDOW_SECONDS, p_limit: USER_LIMIT }),
      admin.rpc("rate_limit_hit", { p_bucket: `create-trip:ip:${ipHash}`, p_window_seconds: WINDOW_SECONDS, p_limit: IP_LIMIT }),
    ]);
    if (byUser.error || byIp.error) throw new Error(`rate limit check failed: ${(byUser.error ?? byIp.error)?.message}`);
    if (byUser.data === false || byIp.data === false) {
      return errorResponse("RATE_LIMITED", "Too many searches in a short time. Wait a few minutes and try again.", requestId, {
        headers: { "Retry-After": String(WINDOW_SECONDS) },
      });
    }

    // 3. Validate.
    const body = await req.json().catch(() => null);
    const now = new Date();
    const parsed = createTripRequestSchema(now).safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Please check the highlighted fields.", requestId, { fieldErrors: toFieldErrors(parsed.error) });
    }
    const request: CreateTripRequest = parsed.data;
    if (request.accessibilityNeeds.length > 0) {
      return errorResponse("VALIDATION_ERROR", "Please check the highlighted fields.", requestId, {
        fieldErrors: { accessibilityNeeds: "Accessibility filters aren't available yet." },
      });
    }

    // 4. Start location must be a supported town.
    const { data: location, error: locError } = await admin
      .from("locations")
      .select("id")
      .eq("id", request.startLocationId)
      .eq("is_active", true)
      .maybeSingle();
    if (locError) throw new Error(`location lookup failed: ${locError.message}`);
    if (!location) return errorResponse("LOCATION_NOT_SUPPORTED", "We can't plan trips from this town yet.", requestId);

    // 5. Engine.
    const catalogue = await loadCatalogue(admin, request.startLocationId);
    const known = new Set(catalogue.moods.map((m) => m.slug));
    if (request.moods.some((m) => !known.has(m))) {
      return errorResponse("VALIDATION_ERROR", "Please check the highlighted fields.", requestId, {
        fieldErrors: { moods: "One of the moods isn't available any more. Choose again." },
      });
    }

    const result = recommend(catalogue, request, now);

    if (!result.ok) {
      await track("recommendations_insufficient", null, {
        eligibleCount: result.eligibleCount,
        duration: request.duration,
        transportMode: request.transportMode,
        moodCount: request.moods.length,
        exclusionCounts: result.exclusionCounts,
      });
      return errorResponse("INSUFFICIENT_DESTINATIONS", insufficientMessage(result.eligibleCount), requestId, {
        details: { eligibleCount: result.eligibleCount, suggestedAdjustments: result.suggestions },
      });
    }

    // 6. Store trip + three recommendations atomically.
    const { data: tripId, error: insertError } = await admin.rpc("create_trip_with_recommendations", {
      p_trip: {
        owner_user_id: user.id,
        start_location_id: request.startLocationId,
        travel_date: request.travelDate,
        date_flexible: request.dateFlexible,
        duration_code: request.duration,
        budget_per_person_minor: request.budgetPerPersonMinor,
        currency: request.currency,
        traveller_count: request.travellerCount,
        travel_group: request.travelGroup,
        moods: request.moods,
        transport_mode: request.transportMode,
        overnight_stay: request.overnightStay,
        accessibility_needs: request.accessibilityNeeds,
        preference_snapshot: request,
        algorithm_version: catalogue.config.version,
      },
      p_recommendations: result.picks.map((p) => ({
        destination_id: p.destination.id,
        position: p.position,
        match_score: p.matchScore,
        score_components: p.scoreComponents,
        match_reason: p.matchReason,
        warnings: p.warnings,
        route_snapshot: {
          mode: p.route.mode,
          distanceKm: p.route.distanceKm,
          durationMinutes: p.route.durationMinutes,
          provider: p.route.provider,
          computedAt: p.route.computedAt,
          isEstimate: true,
        },
        cost_snapshot: p.cost,
        access_snapshot: p.access,
      })),
    });
    if (insertError || !tripId) throw new Error(`trip insert failed: ${insertError?.message}`);

    const { data: recs, error: recError } = await admin
      .from("trip_recommendations")
      .select("id, position")
      .eq("trip_id", tripId);
    if (recError || !recs) throw new Error(`recommendation read failed: ${recError?.message}`);
    const idByPosition = new Map(recs.map((r) => [r.position, r.id]));

    await track("recommendations_generated", tripId, {
      duration: request.duration,
      transportMode: request.transportMode,
      moodCount: request.moods.length,
      limitedVariety: result.limitedVariety,
      algorithmVersion: catalogue.config.version,
    });

    return json(
      {
        tripId,
        algorithmVersion: catalogue.config.version,
        limitedVariety: result.limitedVariety,
        recommendations: result.picks.map((p) => toResponseItem(p, idByPosition.get(p.position)!)),
      },
      201,
    );
  } catch (err) {
    console.error(`create-trip ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong on our side. Please try again.", requestId);
  }
});
