import Link from "next/link";
import { ArrowRight, ButtonLink } from "@/components/button-link";
import { DestinationCard } from "@/components/destination-card";
import { Photo } from "@/components/photo";
import { TrackEvent } from "@/lib/analytics";
import { getBrowseDestinations } from "@/lib/destination-data";

const steps = [
  {
    title: "Tell us your trip",
    body: "Where you're starting, when, your per-person budget and the mood you're after.",
    tone: "green",
  },
  {
    title: "See three good matches",
    body: "Each comes with an estimated cost, travel time and why it fits.",
    tone: "green",
  },
  {
    title: "Spin to decide",
    body: "Every option has an equal chance. Then plan, save or share.",
    tone: "warm",
  },
] as const;

export default async function HomePage() {
  const curated = (await getBrowseDestinations()).slice(0, 6);
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4">
      <TrackEvent event="homepage_view" />
      {/* Hero */}
      <section className="grid gap-4 pt-8 lg:grid-cols-2 lg:items-center lg:gap-12 lg:pt-16">
        <div className="flex flex-col gap-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-green">
            Budget · Time · Mood
          </p>
          <h1 className="text-[40px] font-bold leading-[1.05] tracking-[-0.02em] lg:text-[56px]">
            Don&apos;t know where to go? Let Kerala surprise you.
          </h1>
          <p className="max-w-prose text-[17px] leading-normal text-muted">
            Tell us your budget, how much time you have and the mood you&apos;re in.
            We&apos;ll shortlist three places that fit, then let the wheel pick one.
          </p>
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
            <ButtonLink href="/plan" variant="primary" className="sm:min-w-56">
              Start Your Trip
              <ArrowRight />
            </ButtonLink>
            <ButtonLink href="/explore" variant="outline" className="sm:min-w-56">
              Explore Destinations
            </ButtonLink>
          </div>
        </div>
        <Photo
          alt="Backwater canal at dawn with a country boat"
          tint="#6F9583"
          caption="Licensed photo · Backwaters at dawn"
          className="mt-3 h-[220px] rounded-hero sm:h-[300px] lg:mt-0 lg:h-[420px]"
        />
      </section>

      {/* Curated */}
      <section aria-labelledby="curated-h" className="flex flex-col gap-4 pt-12">
        <div className="flex items-baseline justify-between">
          <h2 id="curated-h" className="text-[26px] font-bold tracking-[-0.01em]">
            Curated destinations
          </h2>
          <Link href="/explore" className="text-[15px] font-semibold">
            See all
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curated.map((d) => (
            <li key={d.slug}>
              <DestinationCard destination={d} />
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-h" className="flex flex-col gap-5 pt-12">
        <h2 id="how-h" className="text-[26px] font-bold tracking-[-0.01em]">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3.5">
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-full font-bold ${
                  step.tone === "warm" ? "bg-warm-tint text-warm-ink" : "bg-green-tint text-green-ink"
                }`}
              >
                {i + 1}
              </span>
              <div>
                <p className="mb-1 text-[17px] font-semibold">{step.title}</p>
                <p className="text-[15px] leading-[1.45] text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section
        aria-labelledby="trust-h"
        className="mt-12 flex flex-col gap-3.5 rounded-card border border-line bg-surface px-5 py-[22px]"
      >
        <h2 id="trust-h" className="text-[22px] font-bold">
          Estimates you can check
        </h2>
        <p className="max-w-prose text-[15px] leading-normal text-muted">
          Costs and travel times are estimates, clearly labelled. Every destination shows
          when its access, permit and seasonal information was last verified, with a link
          to the official source.
        </p>
        <ul className="flex flex-col gap-2.5 text-[15px]">
          <li className="flex items-center gap-2.5">
            <span className="rounded-label bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-soft">
              Estimated
            </span>
            cost and travel time
          </li>
          <li className="flex items-center gap-2.5">
            <span className="rounded-label bg-green-tint px-2 py-0.5 text-xs font-semibold text-green-ink">
              Last verified
            </span>
            dates on access info
          </li>
          <li className="flex items-center gap-2.5">
            <span className="rounded-label bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn-label">
              Check source
            </span>
            when info is due a review
          </li>
        </ul>
      </section>
    </main>
  );
}
