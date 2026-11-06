"use client";

import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import type { CreateTripRequest } from "@shared/trip-request";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** The error envelope every Edge Function uses (DATABASE_API_SPEC §9). */
export type ApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;
  requestId?: string;
};

export type CreateTripResult =
  | { ok: true; tripId: string }
  | { ok: false; kind: "api"; status: number; error: ApiError }
  | { ok: false; kind: "network" | "auth" | "captcha" | "unavailable"; error?: ApiError };

/**
 * Ensures the visitor has a session, signing in anonymously on first submit (ARCHITECTURE §4).
 * With Turnstile configured, the sign-in carries a CAPTCHA token (Supabase checks it); the check
 * runs only when there is no session yet.
 */
async function ensureSession(getCaptchaToken?: () => Promise<string | null>): Promise<"ok" | "auth" | "captcha"> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return "ok";
  let captchaToken: string | undefined;
  if (getCaptchaToken) {
    const token = await getCaptchaToken();
    if (!token) return "captcha";
    captchaToken = token;
  }
  const { error } = await supabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
  if (!error) return "ok";
  return /captcha/i.test(error.message) ? "captcha" : "auth";
}

/** Calls the `create-trip` Edge Function. Never throws. */
export async function createTrip(
  request: CreateTripRequest,
  getCaptchaToken?: () => Promise<string | null>,
): Promise<CreateTripResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, kind: "network" };

  try {
    const session = await ensureSession(getCaptchaToken);
    if (session !== "ok") return { ok: false, kind: session };

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.functions.invoke<{ tripId: string }>("create-trip", {
      body: request,
    });

    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const envelope = await response.json().catch(() => null);
      const apiError: ApiError | undefined = envelope?.error?.code ? envelope.error : undefined;
      if (!apiError) return { ok: false, kind: "unavailable" };
      return { ok: false, kind: "api", status: response.status, error: apiError };
    }
    if (error instanceof FunctionsFetchError) return { ok: false, kind: "network" };
    if (error instanceof FunctionsRelayError || error) return { ok: false, kind: "unavailable" };
    if (!data?.tripId) return { ok: false, kind: "unavailable" };
    return { ok: true, tripId: data.tripId };
  } catch {
    return { ok: false, kind: "network" };
  }
}
