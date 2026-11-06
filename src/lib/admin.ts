import { connection } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = { userId: string; email: string | null; role: "editor" | "admin" };

/**
 * The signed-in editor or admin, or null. Reads the caller's own admin_users row under RLS.
 * Pages use this for messaging only; every write is still checked by RLS and publish_destination().
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  await connection(); // per-request: callers compare against the current time
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || claims.is_anonymous === true) return null;
  const { data: row } = await supabase.from("admin_users").select("role, is_active").eq("user_id", claims.sub).maybeSingle();
  if (!row?.is_active) return null;
  return { userId: claims.sub, email: (claims.email as string | undefined) ?? null, role: row.role };
}
