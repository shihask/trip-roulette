/** Service-role client and caller verification for Edge Functions (Deno only). */
import { createClient, type User } from "@supabase/supabase-js";

function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  return keys.default ?? Object.values(keys)[0];
}

export const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** The signed-in caller (anonymous or permanent), or null. */
export async function getCaller(req: Request): Promise<User | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

/** True when the bearer token is one of this project's secret (service-role) keys. */
export function isServiceCaller(req: Request): boolean {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const keys = [
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ...Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>),
  ].filter(Boolean);
  const enc = new TextEncoder();
  const a = enc.encode(token);
  return keys.some((k) => {
    const b = enc.encode(k);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  });
}

/** True when the caller is an active, non-anonymous admin. */
export async function isAdminCaller(req: Request): Promise<boolean> {
  const user = await getCaller(req);
  if (!user || user.is_anonymous) return false;
  const { data } = await admin.from("admin_users").select("role, is_active").eq("user_id", user.id).maybeSingle();
  return data?.is_active === true && data.role === "admin";
}

export async function rateLimited(bucket: string, windowSeconds: number, limit: number): Promise<boolean> {
  const { data, error } = await admin.rpc("rate_limit_hit", { p_bucket: bucket, p_window_seconds: windowSeconds, p_limit: limit });
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  return data === false;
}
