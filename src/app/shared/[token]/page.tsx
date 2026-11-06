import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark, BrandName } from "@/components/brand-mark";
import { ButtonLink } from "@/components/button-link";
import { Photo } from "@/components/photo";
import { formatClock, formatDate, formatMoney, formatShortDate } from "@/lib/format";
import { getSharedTrip } from "@/lib/shared-trip";

/** Shared trip (BUILD_BRIEF §6): a frozen, read-only snapshot. No account or private information. */

export async function generateMetadata({ params }: PageProps<"/shared/[token]">): Promise<Metadata> {
  const { token } = await params;
  const r = await getSharedTrip(token);
  const base: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
  if (r.status !== "ok") return { ...base, title: "Shared trip" };
  const s = r.snapshot;
  const title = `Trip plan: ${s.destination.name} from ${s.startTown}`;
  const description = `${s.durationLabel} · ${s.destination.district} · Estimated ${formatMoney(s.cost.perPerson)} per person. A shared plan, not a booking.`;
  return { ...base, title, description, openGraph: { title, description, type: "article", siteName: "Trip Roulette Kerala" } };
}

export default function SharedTripPage({ params }: PageProps<"/shared/[token]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="Trip Roulette Kerala, home">
            <BrandMark />
            <BrandName />
          </Link>
        </div>
      </header>
      <Suspense fallback={<SharedSkeleton />}>
        {params.then(({ token }) => (
          <SharedTrip token={token} />
        ))}
      </Suspense>
    </div>
  );
}

function StartOwn({ dark = false }: { dark?: boolean }) {
  return dark ? (
    <section aria-labelledby="own-h" className="flex flex-col gap-2 rounded-card bg-footer p-5 text-white">
      <h2 id="own-h" className="text-[22px] font-bold">
        Where would Kerala send you?
      </h2>
      <p className="text-[15px] leading-normal text-footer-text">Set your own budget, time and mood, and spin for your own trip.</p>
      <Link href="/plan" className="mt-1.5 flex h-[52px] items-center justify-center rounded-control bg-surface font-semibold text-ink no-underline hover:text-ink">
        Start your own trip
      </Link>
    </section>
  ) : (
    <ButtonLink href="/plan" variant="primary" className="self-stretch sm:self-start">
      Start your own trip
    </ButtonLink>
  );
}

async function SharedTrip({ token }: { token: string }) {
  const r = await getSharedTrip(token);

  if (r.status === "gone") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 pt-10">
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
          <h1 className="text-[26px] font-bold">This trip link has expired</h1>
          <p className="text-[15px] leading-normal text-ink-soft">
            The person who shared it may have turned it off. Ask them for a new link, or plan your own trip.
          </p>
          <StartOwn />
        </section>
      </main>
    );
  }
  if (r.status === "error") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 pt-10">
        <div role="alert" className="flex flex-col gap-3 rounded-card border border-error-border bg-error-bg p-5 text-error-text">
          <h1 className="text-[24px] font-bold">We couldn&apos;t load this trip</h1>
          <p className="text-[15px]">Check your connection and reload the page.</p>
        </div>
      </main>
    );
  }

  const s = r.snapshot;
  const chips = [
    `From ${s.startTown}`,
    s.dateFlexible || !s.travelDate ? "Flexible dates" : formatShortDate(s.travelDate),
    s.durationLabel,
    `${s.travellerCount} ${s.travellerCount === 1 ? "traveller" : "travellers"} · ${s.transportMode === "public_transport" ? "Public transport" : s.transportMode === "bike" ? "Bike" : "Car"}`,
  ];
  const days = [...new Set(s.itinerary.map((i) => i.day))];

  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-12 pt-4">
      <div role="note" className="flex items-start gap-2.5 rounded-control bg-green-tint px-3.5 py-3">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="mt-0.5 flex-none">
          <circle cx="9" cy="9" r="7.5" fill="none" stroke="#145239" strokeWidth="1.6" />
          <path d="M9 8v4.5M9 5.5v.1" stroke="#145239" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <p className="text-[15px] text-green-ink">
          <strong>Shared trip plan, not a booking.</strong> Nothing here is reserved or paid for.
        </p>
      </div>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <Photo alt={s.destination.image?.alt || `Photo of ${s.destination.name}`} tint="#5C8A62" className="h-[180px] sm:h-[240px]" />
        <div className="flex flex-col gap-2 p-4">
          <p className="text-sm text-muted">A friend shared this {s.durationLabel.toLowerCase()} plan</p>
          <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.02em]">{s.destination.name}</h1>
          <p className="text-[15px] text-muted">
            {s.destination.district} · {s.destination.type}
          </p>
          <ul className="flex flex-wrap gap-1.5 pt-1 text-sm">
            {chips.map((c) => (
              <li key={c} className="rounded-full bg-surface-muted px-2.5 py-1">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="sc-h" className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4">
        <div>
          <h2 id="sc-h" className="mb-1 font-body text-[15px] font-semibold text-muted">
            Estimated cost per person
          </h2>
          <p className="text-sm text-muted">{s.cost.included.join(", ")}</p>
          {s.cost.notIncluded.length ? <p className="mt-1 text-[13px] text-muted">Not included: {s.cost.notIncluded.join("; ")}.</p> : null}
        </div>
        <p className="flex-none font-display text-[28px] font-bold">{formatMoney(s.cost.perPerson)}</p>
      </section>

      <section aria-labelledby="si-h" className="flex flex-col gap-3">
        <h2 id="si-h" className="text-[22px] font-bold">
          Itinerary
        </h2>
        <p className="-mt-1.5 text-sm text-muted">A suggestion, not a booking. Times are estimates.</p>
        {s.itinerary.length === 0 ? (
          <p className="text-[15px] text-muted">No itinerary was included.</p>
        ) : (
          days.map((day) => (
            <div key={day} className="flex flex-col gap-1.5">
              {days.length > 1 ? <h3 className="font-body text-base font-semibold">Day {day}</h3> : null}
              <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
                {s.itinerary
                  .filter((i) => i.day === day)
                  .map((i) => (
                    <li key={i.sequence} className="flex gap-3.5 border-b border-surface-muted px-4 py-3 last:border-0">
                      <span className="w-[72px] flex-none text-sm font-semibold text-green-ink">{i.startLocal ? formatClock(i.startLocal) : ""}</span>
                      <span className="text-[15px]">{i.title}</span>
                    </li>
                  ))}
              </ol>
            </div>
          ))
        )}
        <p className="text-sm text-muted">
          {s.accessLastVerifiedAt ? `Access info last verified ${formatDate(s.accessLastVerifiedAt)}. ` : ""}
          Check the official source before travelling.{" "}
          <Link href={`/destinations/${s.destination.slug}`}>About {s.destination.name}</Link>
        </p>
      </section>

      <StartOwn dark />
      <p className="text-xs text-muted">This link expires {formatDate(r.expiresAt)}.</p>
    </main>
  );
}

function SharedSkeleton() {
  return (
    <main id="main" aria-busy="true" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-4">
      <p role="status" className="sr-only">
        Loading shared trip…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-5">
        <div className="h-12 animate-pulse rounded-control bg-surface-muted" />
        <div className="h-[340px] animate-pulse rounded-card bg-surface-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
      </div>
    </main>
  );
}
