/** HTTP helpers for Edge Functions (Deno only): CORS and the error envelope (DATABASE_API_SPEC §9). */

/**
 * Browser origins allowed to call the functions: the `ALLOWED_ORIGINS` function secret, comma
 * separated (e.g. `https://example.com,http://localhost:3000`). Unset means any origin (`*`).
 * CORS only limits which websites a browser lets call us; server-to-server callers are limited by
 * the auth and rate-limit checks in each function, not by this.
 */
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export function corsFor(origin: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (allowedOrigins.length === 0) return { ...base, "Access-Control-Allow-Origin": "*" };
  if (origin && allowedOrigins.includes(origin)) return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  return { ...base, Vary: "Origin" }; // no Allow-Origin: the browser blocks the call
}

/** Deno.serve with CORS: answers preflights and adds the CORS headers to every response. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    const cors = corsFor(req.headers.get("origin"));
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const res = await handler(req);
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  });
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TRIP_NOT_FOUND"
  | "DESTINATION_NOT_FOUND"
  | "TRIP_STALE"
  | "SPIN_REQUIRED"
  | "SHARE_LINK_EXPIRED"
  | "TRIP_EXPIRED"
  | "LOCATION_NOT_SUPPORTED"
  | "INSUFFICIENT_DESTINATIONS"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "PROVIDER_UNAVAILABLE";

const statusFor: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TRIP_NOT_FOUND: 404,
  DESTINATION_NOT_FOUND: 404,
  TRIP_STALE: 409,
  SPIN_REQUIRED: 409,
  SHARE_LINK_EXPIRED: 410,
  TRIP_EXPIRED: 410,
  LOCATION_NOT_SUPPORTED: 422,
  INSUFFICIENT_DESTINATIONS: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  PROVIDER_UNAVAILABLE: 503,
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  requestId: string,
  opts: { fieldErrors?: Record<string, string>; details?: Record<string, unknown>; headers?: Record<string, string> } = {},
): Response {
  return json(
    { error: { code, message, fieldErrors: opts.fieldErrors ?? {}, details: opts.details ?? {}, requestId } },
    statusFor[code],
    opts.headers,
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** First address in X-Forwarded-For (set by the Supabase edge), else empty. */
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
}
