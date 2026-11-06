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
  | { ok: false; kind: "network" | "auth" | "unavailable"; error?: ApiError };

/**
 * Ensures the visitor has a session, signing in anonymously on first submit (ARCHITECTURE §4).
 * TODO(captcha): pass `options.captchaToken` once CAPTCHA is enabled on the project.
 */
async function ensureSession(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  const { error } = await supabase.auth.signInAnonymously();
  return !error;
}

/** Calls the `create-trip` Edge Function. Never throws. */
export async function createTrip(request: CreateTripRequest): Promise<CreateTripResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, kind: "network" };

  try {
    if (!(await ensureSession())) return { ok: false, kind: "auth" };

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
