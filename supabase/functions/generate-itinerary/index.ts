/**
 * generate-itinerary (DATABASE_API_SPEC §8.7, ARCHITECTURE §8). Owner only. Rebuilds the stored
 * itinerary for a spun trip with an optional departure time; every other input comes from stored
 * data. The result is a suggestion, never a booking.
 * Deployed with verify_jwt off: the caller's token is verified here with Supabase Auth.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped nested selects from supabase-js */
import { admin, getCaller, rateLimited } from "../_shared/admin.ts";
import { clientIp, errorResponse, json, sha256Hex, serve } from "../_shared/http.ts";
import { generateAndStoreItinerary } from "../_shared/trip-itinerary.ts";
import { generateItineraryRequestSchema } from "../_shared/itinerary-request.ts";
import { toFieldErrors } from "../_shared/trip-request.ts";

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);

  try {
    const user = await getCaller(req);
    if (!user) return errorResponse("UNAUTHORIZED", "Please start a guest session and try again.", requestId);

    const parsed = generateItineraryRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Please check the highlighted fields.", requestId, { fieldErrors: toFieldErrors(parsed.error) });
    }
    const { tripId, departureLocalTime } = parsed.data;

    const ipHash = await sha256Hex(`itinerary:${clientIp(req)}`);
    if ((await rateLimited(`generate-itinerary:user:${user.id}`, 600, 30)) || (await rateLimited(`generate-itinerary:ip:${ipHash}`, 600, 90))) {
      return errorResponse("RATE_LIMITED", "Too many changes in a short time. Wait a few minutes and try again.", requestId, {
        headers: { "Retry-After": "600" },
      });
    }

    const { data: trip, error } = await admin.from("trips").select("id, owner_user_id, status, expires_at").eq("id", tripId).maybeSingle();
    if (error) throw new Error(`trip read failed: ${error.message}`);
    if (!trip || trip.owner_user_id !== user.id) return errorResponse("TRIP_NOT_FOUND", "We can't find this trip.", requestId);
    if (trip.status === "expired" || new Date(trip.expires_at).getTime() < Date.now()) {
      return errorResponse("TRIP_EXPIRED", "This trip has expired. Start a new one.", requestId);
    }

    const { data: result, error: resultError } = await admin
      .from("roulette_results")
      .select("recommendation_id, recommendation:trip_recommendations(access_snapshot)")
      .eq("trip_id", tripId)
      .maybeSingle();
    if (resultError) throw new Error(`result read failed: ${resultError.message}`);
    if (!result) return errorResponse("SPIN_REQUIRED", "Spin the wheel first; then you can change the plan.", requestId);

    const itinerary = await generateAndStoreItinerary(admin, tripId, result.recommendation_id, departureLocalTime ?? undefined);

    const { error: eventError } = await admin.from("analytics_events").insert({
      event_type: "itinerary_generated",
      trip_id: tripId,
      metadata: { custom_departure: departureLocalTime != null },
    });
    if (eventError) console.error("analytics insert failed", eventError.message);

    return json({
      status: "suggested",
      items: itinerary.items,
      warnings: itinerary.warnings,
      dataAsOf: (result.recommendation as any)?.access_snapshot?.lastVerifiedAt ?? null,
    });
  } catch (err) {
    console.error(`generate-itinerary ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong on our side. Please try again.", requestId);
  }
});
