/**
 * refresh-routes (ARCHITECTURE §16). Service role or an admin. Runs
 * public.refresh_route_estimates(): adds estimated car and bike routes for every active town ×
 * non-archived destination that has none, and (unless onlyMissing) recomputes rows that are still
 * estimates. Routes entered by editors or a routing provider are never overwritten.
 * pg_cron runs it weekly. When a routing provider is chosen (ARCHITECTURE §17), replace the
 * estimate here and store the provider's name in `provider`.
 */
import { admin, isAdminCaller, isServiceCaller } from "../_shared/admin.ts";
import { errorResponse, json, serve } from "../_shared/http.ts";

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return errorResponse("VALIDATION_ERROR", "Use POST.", requestId);

  try {
    if (!isServiceCaller(req) && !(await isAdminCaller(req))) return errorResponse("FORBIDDEN", "Admins only.", requestId);

    const body = await req.json().catch(() => ({}));
    const onlyMissing = body?.onlyMissing === true;
    const { data, error } = await admin.rpc("refresh_route_estimates", { only_missing: onlyMissing });
    if (error) throw new Error(error.message);
    return json({ onlyMissing, ...(data as Record<string, number>) });
  } catch (err) {
    console.error(`refresh-routes ${requestId}`, err instanceof Error ? err.message : err);
    return errorResponse("INTERNAL_ERROR", "Route refresh failed.", requestId);
  }
});
