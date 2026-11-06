/**
 * get-shared-trip (DATABASE_API_SPEC §8.8). Public: callable with the publishable key, no session.
 * Returns the frozen snapshot, or 410 SHARE_LINK_EXPIRED for expired, revoked or unknown tokens
 * (unknown tokens get the same answer, so nothing can be learned by guessing).
 */
import { admin, rateLimited } from "../_shared/admin.ts";
import { clientIp, errorResponse, json, sha256Hex, serve } from "../_shared/http.ts";
import { SHARE_TOKEN } from "../_shared/share.ts";

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);

  try {
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    const gone = () => errorResponse("SHARE_LINK_EXPIRED", "This trip link has expired or was turned off.", requestId);
    if (!SHARE_TOKEN.test(token)) return gone();

    const ipHash = await sha256Hex(`shared:${clientIp(req)}`);
    if (await rateLimited(`get-shared-trip:ip:${ipHash}`, 600, 300)) {
      return errorResponse("RATE_LIMITED", "Too many requests. Wait a few minutes and try again.", requestId, { headers: { "Retry-After": "600" } });
    }

    const { data: link, error } = await admin
      .from("trip_share_links")
      .select("snapshot, expires_at, revoked_at")
      .eq("token_hash", await sha256Hex(token))
      .maybeSingle();
    if (error) throw new Error(`link read failed: ${error.message}`);
    if (!link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now()) return gone();

    return json({ snapshot: link.snapshot, expiresAt: link.expires_at }, 200, { "Cache-Control": "private, no-store" });
  } catch (err) {
    console.error(`get-shared-trip ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong on our side. Please try again.", requestId);
  }
});
