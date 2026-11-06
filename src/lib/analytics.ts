"use client";

import { useEffect, useRef } from "react";
import type { ClientEventMetadata, ClientEventType } from "@shared/analytics.ts";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const AID_KEY = "tr.aid";

/** Random first-party ID for returning-visitor counts. Only its hash leaves the server. */
function anonymousId(): string | null {
  try {
    let id = localStorage.getItem(AID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(AID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Respect browser privacy signals, and keep automated browsers (tests, bots) out of the numbers. */
function trackingAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !nav.webdriver && nav.globalPrivacyControl !== true && nav.doNotTrack !== "1";
}

/** Sends an allow-listed event to `track-event`. Fire-and-forget; never throws. */
export function track<E extends ClientEventType>(eventType: E, metadata?: ClientEventMetadata<E>, tripId?: string): void {
  if (!trackingAllowed()) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  void (async () => {
    try {
      // The session token lets the server attach the trip ID (only if the caller owns the trip).
      let bearer = key;
      if (tripId) {
        const { data } = await getSupabaseBrowserClient().auth.getSession();
        bearer = data.session?.access_token ?? key;
      }
      await fetch(`${url}/functions/v1/track-event`, {
        method: "POST",
        keepalive: true,
        headers: { apikey: key, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, tripId: tripId ?? null, anonymousId: anonymousId(), metadata: metadata ?? {} }),
      });
    } catch {
      // Analytics must never affect the page.
    }
  })();
}

/** Tracks an event once when the component mounts. */
export function TrackEvent<E extends ClientEventType>({ event, metadata, tripId }: { event: E; metadata?: ClientEventMetadata<E>; tripId?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event, metadata, tripId);
  }, [event, metadata, tripId]);
  return null;
}

function pageKind(pathname: string): ClientEventMetadata<"start_trip_clicked">["from"] {
  if (pathname === "/") return "home";
  if (pathname === "/explore") return "explore";
  if (pathname.startsWith("/destinations/")) return "destination";
  if (pathname === "/saved") return "saved";
  if (pathname.startsWith("/shared/")) return "shared";
  if (pathname.startsWith("/trip/")) return "trip";
  return "other";
}

/** Records `start_trip_clicked` for every link to the planner, wherever it is on the site. */
export function StartTripClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || new URL(link.href, location.href).pathname !== "/plan" || location.pathname === "/plan") return;
      track("start_trip_clicked", { from: pageKind(location.pathname) });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
