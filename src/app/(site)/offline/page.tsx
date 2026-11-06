import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };

/** Served by the service worker when a page isn't available offline. */
export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pt-12">
      <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">You&apos;re offline</h1>
      <p className="text-[17px] leading-normal text-muted">
        This page isn&apos;t available without a connection. Your saved trips still open. Planning a new trip and spinning
        need a connection.
      </p>
      <ButtonLink href="/saved" variant="primary" className="self-start">
        Open saved trips
      </ButtonLink>
    </main>
  );
}
