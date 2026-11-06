import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/button-link";
import { DestinationLayout } from "@/components/destination/destination-layout";
import {
  AccessInfo,
  AttractionList,
  DestinationHero,
  DestinationIntro,
  PublicCostTable,
  PublicKeyFacts,
  Section,
  SourceList,
} from "@/components/destination/sections";
import { TrackEvent } from "@/lib/analytics";
import { getPublishedDestination, getPublishedSlugs } from "@/lib/destination-data";

/** Public destination page (no trip context: no fuel share, no itinerary). Static, revalidated on publish. */

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/destinations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublishedDestination(slug);
  if (!d) return { title: "Destination not found" };
  return {
    title: `${d.name}, ${d.district}`,
    description: d.shortDescription,
    openGraph: { title: `${d.name} · Trip Roulette Kerala`, description: d.shortDescription, type: "article" },
  };
}

export default function DestinationPage({ params }: PageProps<"/destinations/[slug]">) {
  return (
    <Suspense fallback={<PublicSkeleton />}>
      {params.then(({ slug }) => (
        <PublicDestination slug={slug} />
      ))}
    </Suspense>
  );
}

async function PublicDestination({ slug }: { slug: string }) {
  const d = await getPublishedDestination(slug);
  if (!d) notFound();

  return (
    <DestinationLayout
      hero={<DestinationHero d={d} />}
      intro={<DestinationIntro d={d} chosenByWheel={false} />}
      summary={
        <>
          <PublicKeyFacts d={d} mapHref={`https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}`} />
          <PublicCostTable costs={d.costs} attractions={d.attractions} />
        </>
      }
    >
      <AttractionList attractions={d.attractions} />
      <Section id="plan-h" title="Plan a trip here">
        <p className="text-[15px] leading-normal text-muted">
          Tell us where you&apos;re starting, your budget and your mood. If {d.name} fits, it can make your shortlist, with a
          full cost estimate and a suggested itinerary.
        </p>
        <ButtonLink href="/plan" variant="primary" className="self-start">
          Start Your Trip
        </ButtonLink>
      </Section>
      <AccessNow d={d} />
      <SourceList sources={d.sources} />
      <TrackEvent event="destination_viewed" metadata={{ source: "public", slug: d.slug }} />
    </DestinationLayout>
  );
}

/**
 * "Access check due" labels compare review dates with the time this block was cached; the cache
 * refreshes at least hourly, matching the destination data itself.
 */
async function AccessNow({ d }: { d: NonNullable<Awaited<ReturnType<typeof getPublishedDestination>>> }) {
  "use cache";
  cacheLife("hours");
  // Cached server component: the clock is read once per cache fill, by design.
  // eslint-disable-next-line react-hooks/purity
  return <AccessInfo access={d.access} requiresPermit={d.requiresPermit} now={Date.now()} />;
}

function PublicSkeleton() {
  return (
    <main id="main" aria-busy="true" className="flex-1">
      <p role="status" className="sr-only">
        Loading destination…
      </p>
      <div aria-hidden="true" className="mx-auto max-w-6xl lg:px-4 lg:pt-6">
        <div className="h-[300px] animate-pulse bg-surface-muted lg:h-[380px] lg:rounded-hero" />
        <div className="flex flex-col gap-3 px-4 pt-5 lg:px-0">
          <div className="h-10 w-48 animate-pulse rounded bg-surface-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-surface-muted" />
        </div>
      </div>
    </main>
  );
}
