"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { DEPARTURE_CHOICES } from "@shared/itinerary-request.ts";
import { buttonVariants } from "@/components/button-link";
import { formatClock } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; warnings: string[] } | { kind: "error"; message: string };

const errorMessages: Record<string, string> = {
  RATE_LIMITED: "Too many changes in a short time. Wait a few minutes and try again.",
  TRIP_EXPIRED: "This trip has expired, so its plan can't change.",
  SPIN_REQUIRED: "Spin the wheel first.",
  UNAUTHORIZED: "Your guest session has ended in this browser, so the plan can't change.",
  TRIP_NOT_FOUND: "Your guest session has ended in this browser, so the plan can't change.",
};

/**
 * "Leave at" control for the suggested itinerary. Calls `generate-itinerary`, which rebuilds the
 * stored plan from stored data, then re-renders the page with the new items.
 */
export function DepartureTimeForm({ tripId, current }: { tripId: string; current: string | null }) {
  const router = useRouter();
  const id = useId();
  const initial = current?.slice(0, 5) ?? "";
  const options = initial && !DEPARTURE_CHOICES.includes(initial) ? [...DEPARTURE_CHOICES, initial].sort() : DEPARTURE_CHOICES;
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [refreshing, startRefresh] = useTransition();
  const busy = status.kind === "busy" || refreshing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value || busy) return;
    if (!navigator.onLine) return setStatus({ kind: "error", message: "You're offline. Changing the plan needs a connection." });
    setStatus({ kind: "busy" });
    try {
      const { data, error } = await getSupabaseBrowserClient().functions.invoke<{ warnings: string[] }>("generate-itinerary", {
        body: { tripId, departureLocalTime: value },
      });
      if (error instanceof FunctionsHttpError) {
        const envelope = await (error.context as Response).json().catch(() => null);
        const code = envelope?.error?.code as string | undefined;
        return setStatus({ kind: "error", message: (code && errorMessages[code]) ?? "The plan couldn't be updated. Try again." });
      }
      if (error instanceof FunctionsFetchError || error || !data) {
        return setStatus({ kind: "error", message: "The plan couldn't be updated. Check your connection and try again." });
      }
      setStatus({ kind: "done", warnings: data.warnings ?? [] });
      startRefresh(() => router.refresh());
    } catch {
      setStatus({ kind: "error", message: "The plan couldn't be updated. Try again." });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl bg-surface-muted p-4" aria-describedby={`${id}-hint`}>
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex min-w-36 flex-1 flex-col gap-1">
          <label htmlFor={`${id}-time`} className="text-sm font-semibold">
            Leave at
          </label>
          <select
            id={`${id}-time`}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus({ kind: "idle" });
            }}
            className="h-11 w-full rounded-xl border-[1.5px] border-line-input bg-surface px-3 text-[15px]"
          >
            {initial ? null : <option value="">Choose a time</option>}
            {options.map((t) => (
              <option key={t} value={t}>
                {formatClock(t)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy || !value || value === initial}
          aria-disabled={busy || !value || value === initial}
          className={`${buttonVariants.outline} h-11 px-4 text-[15px] disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {busy ? "Updating…" : "Update plan"}
        </button>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted">
        Times and stops are recalculated from your departure. Stops that no longer fit are left out.
      </p>
      <div role="status" aria-live="polite" className="text-sm">
        {status.kind === "done" && !refreshing ? (
          <>
            <p className="font-semibold text-green-ink">Plan updated: leaving at {formatClock(value)}.</p>
            {status.warnings.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-muted">
                {status.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        {status.kind === "error" ? <p className="font-medium text-error-inline">{status.message}</p> : null}
      </div>
    </form>
  );
}
