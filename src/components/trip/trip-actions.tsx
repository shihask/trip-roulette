"use client";

import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/button-link";
import { formatDate } from "@/lib/format";
import { refreshSavedTrip, removeSavedTrip, saveTrip, useIsClient, useSavedTrips, type SavedTrip } from "@/lib/saved-trips";
import { createShareLink, listShareLinks, revokeShareLink, type ShareLink, type ShareLinkRow } from "@/lib/share";
import { track } from "@/lib/analytics";

/** Bottom bar on the trip destination page: Save (local) and Share trip. Never covers content (the page pads for it). */
export function TripActionBar({ trip }: { trip: Omit<SavedTrip, "savedAt"> }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-xl gap-2.5 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3.5">
        <SaveTripButton trip={trip} />
        <ShareTripButton tripId={trip.tripId} destinationName={trip.destination.name} />
      </div>
    </div>
  );
}

function SaveTripButton({ trip }: { trip: Omit<SavedTrip, "savedAt"> }) {
  const isClient = useIsClient();
  const saved = useSavedTrips().some((t) => t.tripId === trip.tripId);
  const [status, setStatus] = useState("");

  // Keep a saved copy current when the server data changes (e.g. a new departure time).
  useEffect(() => {
    if (saved) refreshSavedTrip(trip);
  }, [saved, trip]);

  function toggle() {
    if (saved) {
      setStatus(removeSavedTrip(trip.tripId) ? "Removed from saved trips." : "Your browser blocked the change.");
    } else {
      const ok = saveTrip({ ...trip, savedAt: new Date().toISOString() });
      setStatus(ok ? "Saved in this browser. Find it under Saved trips." : "Your browser blocked saving (private mode or storage turned off).");
      if (ok) track("trip_saved", {}, trip.tripId);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={!isClient}
        aria-pressed={isClient ? saved : undefined}
        className={`${buttonVariants.outline} flex-[0_0_120px] gap-1.5 px-0 ${saved ? "border-green bg-green-tint text-green-ink hover:border-green hover:text-green-ink" : ""}`}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M4.5 2.5h9v13L9 12.2 4.5 15.5z" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        {saved ? "Saved" : "Save"}
      </button>
      <p role="status" className="sr-only">
        {status}
      </p>
    </>
  );
}

function ShareTripButton({ tripId, destinationName }: { tripId: string; destinationName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function openDialog() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        className={`${buttonVariants.primary} h-[52px] flex-1 text-base`}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M9 11V2.5M5.5 6L9 2.5 12.5 6M3 10v4.5h12V10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Share trip
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="share-h"
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        className="m-auto w-[min(100%-32px,480px)] rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-ink/50"
      >
        {open ? <ShareDialogBody tripId={tripId} destinationName={destinationName} onClose={() => dialogRef.current?.close()} /> : null}
      </dialog>
    </>
  );
}

type LinkState = { kind: "creating" } | { kind: "ready"; link: ShareLink } | { kind: "error"; message: string } | { kind: "revoked" };

/** Created once per page visit, so reopening the dialog doesn't make a new link each time. */
let linkThisVisit: { tripId: string; link: ShareLink } | null = null;

function ShareDialogBody({ tripId, destinationName, onClose }: { tripId: string; destinationName: string; onClose: () => void }) {
  const [state, setState] = useState<LinkState>(
    linkThisVisit?.tripId === tripId ? { kind: "ready", link: linkThisVisit.link } : { kind: "creating" },
  );
  const [copied, setCopied] = useState(false);
  const [others, setOthers] = useState<ShareLinkRow[] | null>(null);
  const [message, setMessage] = useState("");
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (state.kind !== "creating") return;
    let cancelled = false;
    createShareLink(tripId).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        linkThisVisit = { tripId, link: r.link };
        setState({ kind: "ready", link: r.link });
      } else {
        setState({
          kind: "error",
          message:
            r.error.code === "SPIN_REQUIRED"
              ? "Spin the wheel first; then you can share the result."
              : r.error.code === "RATE_LIMITED"
                ? "Too many links in a short time. Wait a few minutes and try again."
                : r.error.code === "NETWORK"
                  ? r.error.message
                  : "We couldn't create a link just now. Try again in a moment.",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.kind, tripId]);

  const currentId = state.kind === "ready" ? state.link.id : null;
  useEffect(() => {
    let cancelled = false;
    listShareLinks(tripId)
      .then((rows) => !cancelled && setOthers(rows.filter((r) => new Date(r.expiresAt).getTime() > Date.now())))
      .catch(() => !cancelled && setOthers([]));
    return () => {
      cancelled = true;
    };
  }, [tripId, currentId]);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setMessage("Link copied.");
    } catch {
      setMessage("Couldn't copy automatically. Select the link above and copy it.");
    }
  }

  async function nativeShare(url: string) {
    try {
      await navigator.share({ title: `Trip plan: ${destinationName}`, text: `Here's our ${destinationName} trip plan`, url });
    } catch {
      // Cancelled or unsupported: the copy and WhatsApp options are still here.
    }
  }

  async function turnOff(id: string, isCurrent: boolean) {
    const r = await revokeShareLink(id);
    if (!r.ok) {
      setMessage(r.error.message);
      return;
    }
    if (isCurrent) {
      linkThisVisit = null;
      setState({ kind: "revoked" });
    }
    setOthers((rows) => rows?.map((x) => (x.id === id ? { ...x, revokedAt: new Date().toISOString() } : x)) ?? null);
    setMessage("Link turned off. Anyone who opens it will see that it has expired.");
  }

  const active = (others ?? []).filter((r) => !r.revokedAt && r.id !== currentId);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="share-h" className="text-[22px] font-bold">
          Share this trip
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-line">
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className="text-[15px] leading-normal text-muted">
        Anyone with the link can see the destination, the plan and the cost estimate. Not your budget, your moods or anything
        about you. It&apos;s a plan, not a booking.
      </p>

      {state.kind === "creating" ? (
        <p role="status" className="text-[15px]">
          Creating a link…
        </p>
      ) : null}

      {state.kind === "error" ? (
        <div role="alert" className="flex flex-col gap-2 rounded-control border border-error-border bg-error-bg p-3.5 text-[15px] text-error-text">
          <p>{state.message}</p>
          <button type="button" onClick={() => setState({ kind: "creating" })} className={`${buttonVariants.outline} h-11 self-start text-[15px]`}>
            Try again
          </button>
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="share-url" className="text-sm font-semibold">
              Trip link
            </label>
            <input
              id="share-url"
              readOnly
              value={state.link.url}
              onFocus={(e) => e.currentTarget.select()}
              aria-describedby="share-expiry"
              className="h-12 w-full rounded-control border-[1.5px] border-line-input bg-ground px-3 text-sm"
            />
            <p id="share-expiry" className="text-sm text-muted">
              Expires {formatDate(state.link.expiresAt)}.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button type="button" onClick={() => copy(state.link.url)} className={`${buttonVariants.primary} h-12 flex-1 text-base`}>
              {copied ? "Copied" : "Copy link"}
            </button>
            {canNativeShare ? (
              <button type="button" onClick={() => nativeShare(state.link.url)} className={`${buttonVariants.outline} h-12 flex-1`}>
                Share…
              </button>
            ) : null}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Our ${destinationName} trip plan: ${state.link.url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonVariants.outline} h-12 flex-1`}
            >
              WhatsApp<span className="sr-only"> (opens WhatsApp or a new tab)</span>
            </a>
          </div>
          <button type="button" onClick={() => turnOff(state.link.id, true)} className="min-h-11 self-start text-[15px] font-semibold text-error-inline">
            Turn off this link
          </button>
        </>
      ) : null}

      {state.kind === "revoked" ? (
        <div className="flex flex-col gap-2">
          <p className="text-[15px]">This link is off.</p>
          <button type="button" onClick={() => setState({ kind: "creating" })} className={`${buttonVariants.outline} h-11 self-start text-[15px]`}>
            Create a new link
          </button>
        </div>
      ) : null}

      {active.length > 0 ? (
        <section aria-labelledby="other-links-h" className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id="other-links-h" className="font-body text-base font-semibold">
            Other links for this trip
          </h3>
          <ul className="flex flex-col gap-2 text-sm">
            {active.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="text-muted">
                  Made {formatDate(r.createdAt)} · expires {formatDate(r.expiresAt)}
                </span>
                <button type="button" onClick={() => turnOff(r.id, false)} className="min-h-11 flex-none font-semibold text-error-inline">
                  Turn off<span className="sr-only"> the link made {formatDate(r.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p role="status" aria-live="polite" className="text-sm text-muted">
        {message}
      </p>
    </div>
  );
}
