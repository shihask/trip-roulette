"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ShareLink = { id: string; url: string; expiresAt: string };
export type ShareLinkRow = { id: string; createdAt: string; expiresAt: string; revokedAt: string | null };

export type ShareError = { code: string; message: string };

async function errorOf(error: unknown): Promise<ShareError> {
  if (error instanceof FunctionsHttpError) {
    const body = await (error.context as Response).json().catch(() => null);
    if (body?.error?.code) return { code: body.error.code, message: body.error.message };
  }
  return { code: "NETWORK", message: "We couldn't reach the server. Check your connection and try again." };
}

export async function createShareLink(tripId: string): Promise<{ ok: true; link: ShareLink } | { ok: false; error: ShareError }> {
  try {
    const { data, error } = await getSupabaseBrowserClient().functions.invoke<{
      shareLinkId: string;
      shareUrl: string | null;
      token: string;
      expiresAt: string;
    }>("create-share-link", { body: { tripId }, timeout: 15_000 });
    if (error || !data) return { ok: false, error: await errorOf(error) };
    const url = data.shareUrl ?? `${window.location.origin}/shared/${data.token}`;
    return { ok: true, link: { id: data.shareLinkId, url, expiresAt: data.expiresAt } };
  } catch (e) {
    return { ok: false, error: await errorOf(e) };
  }
}

export async function revokeShareLink(shareLinkId: string): Promise<{ ok: true } | { ok: false; error: ShareError }> {
  try {
    const { error } = await getSupabaseBrowserClient().functions.invoke("revoke-share-link", { body: { shareLinkId }, timeout: 15_000 });
    return error ? { ok: false, error: await errorOf(error) } : { ok: true };
  } catch (e) {
    return { ok: false, error: await errorOf(e) };
  }
}

/** The trip's links (never the token), read under RLS. */
export async function listShareLinks(tripId: string): Promise<ShareLinkRow[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("trip_share_links")
    .select("id, created_at, expires_at, revoked_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((r) => ({ id: r.id, createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: r.revoked_at }));
}
