/**
 * track-event (DATABASE_API_SPEC §8.9). Callable with the anon key (events before sign-in).
 * Unknown event types or metadata keys are rejected. A trip ID is kept only when the caller owns
 * that trip; the browser's random ID is stored only as a hash. Nothing location-based is stored.
 */
import { admin, getCaller, rateLimited } from "../_shared/admin.ts";
import { trackEventRequestSchema } from "../_shared/analytics.ts";
import { clientIp, errorResponse, sha256Hex, serve } from "../_shared/http.ts";
import { toFieldErrors } from "../_shared/trip-request.ts";

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);

  try {
    const parsed = trackEventRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Unknown event or metadata.", requestId, { fieldErrors: toFieldErrors(parsed.error) });
    }
    const { eventType, tripId, anonymousId, metadata } = parsed.data;

    const ipHash = await sha256Hex(`track:${clientIp(req)}`);
    const anonymousIdHash = anonymousId ? await sha256Hex(`aid:${anonymousId}`) : null;
    if (
      (await rateLimited(`track-event:ip:${ipHash}`, 600, 300)) ||
      (anonymousIdHash && (await rateLimited(`track-event:aid:${anonymousIdHash}`, 600, 120)))
    ) {
      return errorResponse("RATE_LIMITED", "Too many events.", requestId, { headers: { "Retry-After": "600" } });
    }

    let ownedTripId: string | null = null;
    if (tripId) {
      const user = await getCaller(req);
      if (user) {
        const { data: trip } = await admin.from("trips").select("id").eq("id", tripId).eq("owner_user_id", user.id).maybeSingle();
        ownedTripId = trip?.id ?? null;
      }
    }

    const { error } = await admin.from("analytics_events").insert({
      event_type: eventType,
      trip_id: ownedTripId,
      anonymous_id_hash: anonymousIdHash,
      metadata,
    });
    if (error) throw new Error(`analytics insert failed: ${error.message}`);

    return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(`track-event ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong on our side.", requestId);
  }
});
