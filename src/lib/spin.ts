"use client";

import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ApiError } from "@/lib/trips";

export type SpinResult = { resultId: string; recommendationId: string; index: number; publicCode: string };

export type SpinOutcome =
  | { ok: true; result: SpinResult }
  /** Timeout or dropped connection: the server may have finished. Check the stored result. */
  | { ok: false; kind: "uncertain" }
  /** The server answered with an error: no result was stored by this request. */
  | { ok: false; kind: "api"; status: number; error: ApiError };

const keyName = (tripId: string) => `tr.spin-key.${tripId}`;
const SPIN_TIMEOUT_MS = 15_000;

/** One Idempotency-Key per spin attempt, kept across retries and reloads in this tab. */
export function getSpinKey(tripId: string): string {
  try {
    const existing = sessionStorage.getItem(keyName(tripId));
    if (existing) return existing;
    const key = crypto.randomUUID();
    sessionStorage.setItem(keyName(tripId), key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearSpinKey(tripId: string): void {
  try {
    sessionStorage.removeItem(keyName(tripId));
  } catch {
    // ignore
  }
}

/** Invokes the `spin` Edge Function. Never throws. */
export async function requestSpin(tripId: string, key: string): Promise<SpinOutcome> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.functions.invoke<SpinResult>("spin", {
      body: { tripId },
      headers: { "Idempotency-Key": key },
      timeout: SPIN_TIMEOUT_MS,
    });
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const envelope = await response.json().catch(() => null);
      if (response.status >= 500 || !envelope?.error?.code) return { ok: false, kind: "uncertain" };
      return { ok: false, kind: "api", status: response.status, error: envelope.error };
    }
    if (error instanceof FunctionsFetchError || error || !data) return { ok: false, kind: "uncertain" };
    return { ok: true, result: data };
  } catch {
    return { ok: false, kind: "uncertain" };
  }
}

/** Reads the stored result for the trip directly under RLS. null = no result yet; throws on network failure. */
export async function readStoredResult(tripId: string): Promise<SpinResult | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("roulette_results")
    .select("id, recommendation_id, selection_index, public_code")
    .eq("trip_id", tripId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data
    ? { resultId: data.id, recommendationId: data.recommendation_id, index: data.selection_index, publicCode: data.public_code }
    : null;
}
