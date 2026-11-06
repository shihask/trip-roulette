import Link from "next/link";
import type { ReactNode } from "react";
import { BrandName } from "@/components/brand-mark";
import { ButtonLink } from "@/components/button-link";

/** Minimal header for trip screens: a back button and the brand (design 3, 4). */
export function TripHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <header className="border-b border-line bg-ground">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Link href="/" className="no-underline" aria-label="Trip Roulette Kerala, home">
          <BrandName />
        </Link>
        <span className="w-11" />
      </div>
    </header>
  );
}

export function TripStateMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pt-12">
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
      <p className="text-[17px] leading-normal text-muted">{children}</p>
      <ButtonLink href="/plan" variant="primary" className="self-start">
        Plan a trip
      </ButtonLink>
    </main>
  );
}

export function TripNotFound() {
  return (
    <TripStateMessage title="We can't find this trip">
      It may have been made in another browser, or the link may be wrong. Trips are kept in the browser that made them.
    </TripStateMessage>
  );
}

export function TripExpired() {
  return (
    <TripStateMessage title="This trip has expired">
      Trips are kept for a limited time. Start a new one with the same preferences in a minute.
    </TripStateMessage>
  );
}
