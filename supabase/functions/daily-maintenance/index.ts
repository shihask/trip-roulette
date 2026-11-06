/**
 * daily-maintenance (ARCHITECTURE §16). Service role only. Runs public.daily_maintenance():
 * deletes expired trips and share links, guests past retention, old rate-limit counters and
 * events, and returns the review-due records for editors. pg_cron runs the same SQL daily; this
 * function is for on-demand runs, e.g.
 *   curl -X POST "$SUPABASE_URL/functions/v1/daily-maintenance" -H "Authorization: Bearer $SECRET_KEY"
 */
import { admin, isServiceCaller } from "../_shared/admin.ts";
import { errorResponse, json, serve } from "../_shared/http.ts";

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);
  if (!isServiceCaller(req)) return errorResponse("FORBIDDEN", "Service role only.", requestId);

  try {
    const { data, error } = await admin.rpc("daily_maintenance");
    if (error) throw new Error(error.message);
    console.log(`daily-maintenance ${requestId}`, JSON.stringify((data as { deleted: unknown }).deleted));
    return json(data);
  } catch (err) {
    console.error(`daily-maintenance ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Maintenance failed.", requestId);
  }
});
