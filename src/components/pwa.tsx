"use client";

import { useEffect, useSyncExternalStore } from "react";

/** Registers the service worker in production builds only (dev reloads would fight the cache). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the site works without offline support.
    });
  }, []);
  return null;
}

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** OfflineBanner (BUILD_BRIEF §5, design 7). */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 px-3 pt-[max(8px,env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-xl items-start gap-2.5 rounded-control bg-footer px-3.5 py-3 text-[15px] text-white shadow-lg">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="mt-0.5 flex-none">
          <path d="M2 6.5a10 10 0 0114 0M4.5 9.2a6.5 6.5 0 019 0M7 11.8a3 3 0 014 0M3 3l12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <p>
          You&apos;re offline. Saved trips still work; spinning needs a connection. Prices, routes and access information may
          be out of date.
        </p>
      </div>
    </div>
  );
}
