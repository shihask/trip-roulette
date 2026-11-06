import { cache } from "react";
import type { SharedTripSnapshot } from "@shared/share";

export type SharedTripResult =
  | { status: "ok"; snapshot: SharedTripSnapshot; expiresAt: string }
  | { status: "gone" }
  | { status: "error" };

/**
 * Fetches a shared trip via the get-shared-trip Edge Function with the publishable key (no session).
 * Never cached (each view checks expiry and revocation); memoised per request so the page and its
 * metadata share one call.
 */
export const getSharedTrip = cache(async (token: string): Promise<SharedTripResult> => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { status: "gone" };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-shared-trip`, {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    if (res.status === 410) return { status: "gone" };
    if (!res.ok) return { status: "error" };
    const body = await res.json();
    return { status: "ok", snapshot: body.snapshot, expiresAt: body.expiresAt };
  } catch {
    return { status: "error" };
  }
});
