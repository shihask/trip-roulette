/**
 * create-share-link (DATABASE_API_SPEC §8.8). Owner only. Freezes a public snapshot of a spun trip
 * and returns an unguessable link. Only the SHA-256 of the token is stored; the token appears only
 * in this response. Links always expire (30 days, the table default).
 */
import { admin, getCaller, rateLimited } from "../_shared/admin.ts";
import { clientIp, errorResponse, json, sha256Hex, serve } from "../_shared/http.ts";
import { buildSnapshot, newShareToken } from "../_shared/share.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public site origin for the link: SITE_URL secret if set, else the caller's browser origin. */
function siteOrigin(req: Request): string {
  const configured = Deno.env.get("SITE_URL");
  const candidate = configured || req.headers.get("origin") || "";
  try {
    const u = new URL(candidate);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : "";
  } catch {
    return "";
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);

  try {
    const user = await getCaller(req);
    if (!user) return errorResponse("UNAUTHORIZED", "Please start a guest session and try again.", requestId);

    const body = await req.json().catch(() => null);
    const tripId = typeof body?.tripId === "string" ? body.tripId : "";
    if (!UUID.test(tripId)) {
      return errorResponse("VALIDATION_ERROR", "Please check the request.", requestId, { fieldErrors: { tripId: "A valid trip ID is required." } });
    }

    const ipHash = await sha256Hex(`share:${clientIp(req)}`);
    if ((await rateLimited(`create-share-link:user:${user.id}`, 600, 20)) || (await rateLimited(`create-share-link:ip:${ipHash}`, 600, 60))) {
      return errorResponse("RATE_LIMITED", "Too many links in a short time. Wait a few minutes and try again.", requestId, {
        headers: { "Retry-After": "600" },
      });
    }

    const { data: trip, error } = await admin.from("trips").select("id, owner_user_id, status, expires_at").eq("id", tripId).maybeSingle();
    if (error) throw new Error(`trip read failed: ${error.message}`);
    if (!trip || trip.owner_user_id !== user.id) return errorResponse("TRIP_NOT_FOUND", "We can't find this trip.", requestId);
    if (trip.status === "expired" || new Date(trip.expires_at).getTime() < Date.now()) {
      return errorResponse("TRIP_EXPIRED", "This trip has expired, so it can't be shared.", requestId);
    }

    let snapshot;
    try {
      snapshot = await buildSnapshot(admin, tripId);
    } catch (err) {
      if (err instanceof Error && err.message === "SPIN_REQUIRED") {
        return errorResponse("SPIN_REQUIRED", "Spin the wheel first; then you can share the result.", requestId);
      }
      throw err;
    }

    const token = newShareToken();
    const { data: link, error: insertError } = await admin
      .from("trip_share_links")
      .insert({ trip_id: tripId, token_hash: await sha256Hex(token), snapshot })
      .select("id, expires_at")
      .single();
    if (insertError || !link) throw new Error(`share insert failed: ${insertError?.message}`);

    const { error: eventError } = await admin.from("analytics_events").insert({ event_type: "trip_shared", trip_id: tripId, metadata: {} });
    if (eventError) console.error("analytics insert failed", eventError.message);

    const origin = siteOrigin(req);
    return json(
      { shareLinkId: link.id, shareUrl: origin ? `${origin}/shared/${token}` : null, token, expiresAt: link.expires_at },
      201,
    );
  } catch (err) {
    console.error(`create-share-link ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong on our side. Please try again.", requestId);
  }
});
