import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
import { DestinationCard } from "@/components/destination-card";
import { getBrowseDestinations } from "@/lib/destination-data";

export const metadata: Metadata = {
  title: "Explore Kerala",
  description: "Every destination Trip Roulette can recommend, with when its access information was last verified.",
};

/** Curated discovery (BUILD_BRIEF §3): the homepage card grid, for every published destination. */
export default async function ExplorePage() {
  const destinations = await getBrowseDestinations();
  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-16 pt-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-bold tracking-[-0.02em] lg:text-[40px]">Explore Kerala</h1>
        <p className="max-w-prose text-base leading-[1.45] text-muted">
          {destinations.length} places in our list. Each shows when its access information was last verified; places due a check
          stay browsable but aren&apos;t recommended until they&apos;re re-verified.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d) => (
          <li key={d.slug}>
            <DestinationCard destination={d} />
          </li>
        ))}
      </ul>
      <ButtonLink href="/plan" variant="primary" className="self-start">
        Start Your Trip
      </ButtonLink>
    </main>
  );
}
