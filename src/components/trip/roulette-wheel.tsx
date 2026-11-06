"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/button-link";
import { clearSpinKey, getSpinKey, readStoredResult, requestSpin, type SpinResult } from "@/lib/spin";
import { track } from "@/lib/analytics";

export type WheelSegment = { recommendationId: string; name: string };

type Phase = "idle" | "pending" | "checking" | "spinning" | "done" | "error";

const COLORS = ["var(--color-wheel-1)", "var(--color-wheel-2)", "var(--color-wheel-3)"];
const SPIN_MS = 3400;
const TURNS = 5;
/** Segment i spans [120i, 120i+120) degrees clockwise from the top; its centre is 120i + 60. */
const centre = (i: number) => i * 120 + 60;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const reducedMotionNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function joinNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}

const errorMessages: Record<string, string> = {
  TRIP_STALE: "One of your places is no longer available, so this trip can't be spun. No spin was used. Start a new trip.",
  TRIP_EXPIRED: "This trip has expired. No spin was used. Start a new trip.",
  TRIP_NOT_FOUND: "We can't find this trip in this browser. No spin was used.",
  RATE_LIMITED: "Too many requests in a short time. No spin was used. Wait a few minutes and try again.",
  UNAUTHORIZED: "Your guest session has ended. No spin was used. Start a new trip.",
};

/**
 * RouletteWheel (BUILD_BRIEF §6 Roulette). The server picks; this only animates to the returned index.
 * A stored result (reload) is shown directly and never spun again.
 */
export function RouletteWheel({
  tripId,
  segments,
  initialResult,
}: {
  tripId: string;
  segments: WheelSegment[];
  initialResult: SpinResult | null;
}) {
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
  const indexOf = useCallback(
    (r: SpinResult) => {
      const i = segments.findIndex((s) => s.recommendationId === r.recommendationId);
      return i >= 0 ? i : r.index;
    },
    [segments],
  );

  const [phase, setPhase] = useState<Phase>(initialResult ? "done" : "idle");
  const [result, setResult] = useState<SpinResult | null>(initialResult);
  const [rotation, setRotation] = useState(initialResult ? 360 - centre(indexOf(initialResult)) : 0);
  const [animate, setAnimate] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [checkFailed, setCheckFailed] = useState(false);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const spunHere = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // After a spin in this visit, move focus to the next step (the Spin button is gone).
  useEffect(() => {
    if (phase === "done" && spunHere.current) ctaRef.current?.focus();
  }, [phase]);

  function reveal(r: SpinResult) {
    const i = indexOf(r);
    const target = 360 - centre(i);
    setResult(r);
    clearSpinKey(tripId);
    spunHere.current = true;
    if (reduced) {
      setAnimate(false);
      setRotation(target);
      setPhase("done");
      return;
    }
    setAnimate(true);
    setRotation((cur) => cur - (((cur % 360) + 360) % 360) + 360 * TURNS + target);
    setPhase("spinning");
    timer.current = setTimeout(() => setPhase("done"), SPIN_MS + 100);
  }

  async function check(retryWithSameKey: boolean) {
    setPhase("checking");
    setCheckFailed(false);
    let stored: SpinResult | null;
    try {
      stored = await readStoredResult(tripId);
    } catch {
      // Can't tell yet whether the server finished; stay here and let the user check again.
      setCheckFailed(true);
      return;
    }
    if (stored) return reveal(stored);
    if (!retryWithSameKey) {
      setErrorText("We couldn't reach the server, so no spin was used. Check your connection and try again.");
      setPhase("error");
      return;
    }
    // No result stored: retry with the SAME key (safe: one result per trip).
    const again = await requestSpin(tripId, getSpinKey(tripId));
    if (again.ok) return reveal(again.result);
    if (again.kind === "api") return fail(again.error.code);
    return check(false);
  }

  function fail(code: string) {
    setErrorText(errorMessages[code] ?? "The spin didn't go through, so no spin was used. Try again.");
    setPhase("error");
  }

  async function spin() {
    if (phase === "pending" || phase === "checking" || phase === "spinning" || phase === "done") return;
    if (!navigator.onLine) {
      setErrorText("You're offline. Spinning needs a connection, and no spin was used.");
      setPhase("error");
      return;
    }
    setPhase("pending");
    track("roulette_spin_started", {}, tripId);
    const outcome = await requestSpin(tripId, getSpinKey(tripId));
    if (outcome.ok) return reveal(outcome.result);
    if (outcome.kind === "api") return fail(outcome.error.code);
    return check(true);
  }

  const busy = phase === "pending" || phase === "checking" || phase === "spinning";
  const winner = result ? segments[indexOf(result)] : null;
  const announcement =
    phase === "pending" || phase === "spinning"
      ? "Choosing a destination…"
      : phase === "checking"
        ? "Checking your spin…"
        : phase === "done" && winner
          ? `The wheel chose ${winner.name}.`
          : phase === "error"
            ? "Spin failed. No result was used."
            : "";
  // Keep the result secret from screen readers until the wheel stops.
  const visibleAnnouncement = phase === "spinning" ? "" : announcement;

  return (
    <div className="flex w-full flex-col items-center gap-[18px]">
      <div className="relative flex w-full max-w-[300px] justify-center pt-[18px]">
        <svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true" className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <path d="M3 3h28L17 27z" fill="#B9461B" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <div
          role="img"
          aria-label={`Wheel with three equal segments: ${joinNames(segments.map((s) => s.name))}${
            phase === "done" && winner ? `. The pointer is on ${winner.name}.` : ""
          }`}
          className="relative aspect-square w-full rounded-full shadow-[0_0_0_6px_#fff,0_10px_30px_rgba(24,33,29,.16)]"
          style={{
            background: `conic-gradient(${COLORS[0]} 0deg 120deg, ${COLORS[1]} 120deg 240deg, ${COLORS[2]} 240deg 360deg)`,
            transform: `rotate(${rotation}deg)`,
            transition: animate ? `transform ${SPIN_MS}ms cubic-bezier(.15,.7,.2,1)` : "none",
          }}
        >
          {segments.map((s, i) => {
            const c = centre(i);
            const rad = (c * Math.PI) / 180;
            return (
              <span
                key={s.recommendationId}
                aria-hidden="true"
                className="absolute w-[38%] text-center text-[15px] font-semibold leading-tight text-white [text-wrap:balance]"
                style={{
                  left: `${50 + Math.sin(rad) * 26}%`,
                  top: `${50 - Math.cos(rad) * 26}%`,
                  transform: `translate(-50%, -50%) rotate(${c}deg)`,
                }}
              >
                {s.name}
              </span>
            );
          })}
          {[0, 120, 240].map((deg) => (
            <span
              key={deg}
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-1/2 w-0.5 origin-top bg-white/55"
              style={{ transform: `rotate(${deg + 180}deg)` }}
            />
          ))}
          <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-[17%] w-[17%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)]" />
        </div>
      </div>

      <p aria-live="polite" className="min-h-[22px] text-center text-base font-semibold">
        {visibleAnnouncement}
      </p>

      {phase === "checking" ? (
        <section className="flex w-full flex-col gap-3 rounded-card border border-line bg-surface p-5">
          <h2 className="text-xl font-bold">Checking your spin…</h2>
          <p className="text-[15px] leading-normal text-ink-soft">
            The connection dropped mid-spin. We&apos;re asking the server for your result. You won&apos;t get a second
            spin by accident.
          </p>
          {checkFailed ? (
            <button type="button" onClick={() => check(true)} className={`${buttonVariants.outline} h-12 text-[15px]`}>
              Check again
            </button>
          ) : null}
        </section>
      ) : null}

      {phase === "error" ? (
        <div role="alert" className="w-full rounded-control border border-error-border bg-error-bg px-3.5 py-3 text-[15px] leading-[1.4] text-error-text">
          {errorText}
        </div>
      ) : null}

      {phase === "done" && result && winner ? (
        <div className="flex w-full flex-col gap-2.5">
          <Link ref={ctaRef} href={`/trip/${tripId}/destination`} className={`${buttonVariants.primary} w-full`}>
            See {winner.name} details
          </Link>
          <p className="text-center text-[13px] text-muted">Result saved to this trip · ID {result.publicCode}</p>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={spin}
            disabled={busy}
            aria-describedby="spin-help"
            className={`${buttonVariants.spin} w-full text-lg disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {phase === "pending" ? "Asking the server…" : phase === "spinning" || phase === "checking" ? "Spinning…" : phase === "error" ? "Try again" : "Spin"}
          </button>
          <Link href={`/trip/${tripId}`} className="flex min-h-11 items-center justify-center text-[15px] font-semibold">
            Back to my matches
          </Link>
        </div>
      )}
    </div>
  );
}
