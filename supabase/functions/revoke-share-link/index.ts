/** revoke-share-link (DATABASE_API_SPEC §8.8). Owner only → 204. Revoking twice is harmless. */
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped nested select from supabase-js */
import { admin, getCaller } from "../_shared/admin.ts";
import { errorResponse, serve } from "../_shared/http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);

  try {
    const user = await getCaller(req);
    if (!user) return errorResponse("UNAUTHORIZED", "Please start a guest session and try again.", requestId);

    const body = await req.json().catch(() => null);
    const id = typeof body?.shareLinkId === "string" ? body.shareLinkId : "";
    if (!UUID.test(id)) {
      return errorResponse("VALIDATION_ERROR", "Please check the request.", requestId, { fieldErrors: { shareLinkId: "A valid link ID is required." } });
    }

    const { data: link, error } = await admin
      .from("trip_share_links")
      .select("id, revoked_at, trip:trips(owner_user_id)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`link read failed: ${error.message}`);
    // deno-lint-ignore no-explicit-any
    if (!link || (link.trip as any)?.owner_user_id !== user.id) {
      return errorResponse("TRIP_NOT_FOUND", "We can't find this link.", requestId);
    }

    if (!link.revoked_at) {
      const { error: updateError } = await admin.from("trip_share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (updateError) throw new Error(`revoke failed: ${updateError.message}`);
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(`revoke-share-link ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong on our side. Please try again.", requestId);
  }
});
