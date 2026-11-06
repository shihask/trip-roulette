import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DestinationLayout } from "@/components/destination/destination-layout";
import {
  AccessInfo,
  AttractionList,
  DestinationHero,
  DestinationIntro,
  ItineraryTimeline,
  SourceList,
  TripCostBreakdown,
  TripKeyFacts,
} from "@/components/destination/sections";
import { TripHeader, TripNotFound, TripStateMessage } from "@/components/trip/trip-shell";
import { ButtonLink } from "@/components/button-link";
import { TripActionBar } from "@/components/trip/trip-actions";
import { DepartureTimeForm } from "@/components/destination/departure-time";
import { TrackEvent } from "@/lib/analytics";
import { getPublishedDestination } from "@/lib/destination-data";
import { formatShortDate } from "@/lib/format";
import type { SavedTrip } from "@/lib/saved-trips";

const DURATION_LABELS = { few_hours: "A few hours", one_day: "One day", two_days: "Two days", three_to_five_days: "3–5 days" } as const;
const TRANSPORT_LABELS = { car: "Car", bike: "Bike", public_transport: "Public transport" } as const;
import { getTrip, getTripItinerary } from "@/lib/trip-data";

export const metadata: Metadata = {
  title: "Your destination",
  robots: { index: false, follow: false },
};

export default function TripDestinationPage({ params }: PageProps<"/trip/[tripId]/destination">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<DestinationSkeleton />}>
        {params.then(({ tripId }) => (
          <TripDestination tripId={tripId} />
        ))}
      </Suspense>
    </div>
  );
}

async function TripDestination({ tripId }: { tripId: string }) {
  await connection(); // per-request: access labels compare review dates with now
  const [trip, itinerary] = await Promise.all([getTrip(tripId), getTripItinerary(tripId)]);
  if (!trip) {
    return (
      <>
        <TripHeader backHref="/plan" backLabel="Back to planning" />
        <TripNotFound />
      </>
    );
  }
  if (!trip.spin) {
    return (
      <>
        <TripHeader backHref={`/trip/${trip.id}`} backLabel="Back to your matches" />
        <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pt-12">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.01em]">Spin first</h1>
          <p className="text-[17px] leading-normal text-muted">
            The wheel hasn&apos;t picked a destination for this trip yet.
          </p>
          <ButtonLink href={`/trip/${trip.id}/roulette`} variant="spin" className="self-start">
            Go to the wheel
          </ButtonLink>
        </main>
      </>
    );
  }

  const rec = trip.recommendations.find((r) => r.id === trip.spin!.recommendationId);
  const d = rec ? await getPublishedDestination(rec.destination.slug) : null;
  if (!rec || !d) {
    return (
      <>
        <TripHeader backHref={`/trip/${trip.id}`} backLabel="Back to your matches" />
        <TripStateMessage title="This destination isn't listed any more">
          It was taken down after your spin, usually because its information changed. Plan a new trip to see current places.
        </TripStateMessage>
      </>
    );
  }

  const origin = trip.startCoords ? `${trip.startCoords.latitude},${trip.startCoords.longitude}` : trip.startLocation;
  const mapHref = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${d.latitude},${d.longitude}&travelmode=driving`;

  const saved: Omit<SavedTrip, "savedAt"> = {
    tripId: trip.id,
    publicCode: trip.spin.publicCode,
    destination: { slug: d.slug, name: d.name, district: d.district, type: d.type },
    startTown: trip.startLocation,
    dateLabel: trip.dateFlexible || !trip.travelDate ? "Flexible dates" : formatShortDate(trip.travelDate),
    durationLabel: DURATION_LABELS[trip.duration],
    travellerCount: trip.travellerCount,
    transportLabel: TRANSPORT_LABELS[trip.transportMode],
    cost: {
      perPerson: rec.cost.perPerson,
      lines: rec.cost.lines.map((l) => ({ label: l.label, minMinor: l.minMinor, maxMinor: l.maxMinor })),
      notIncluded: rec.cost.notIncluded,
    },
    itinerary: itinerary.map((i) => ({ day: i.day, sequence: i.sequence, title: i.title, startLocal: i.startLocal, endLocal: i.endLocal })),
    accessLastVerifiedAt: rec.lastVerifiedAt,
  };

  return (
    <>
    <DestinationLayout
      bottomPadding
      hero={<DestinationHero d={d} back={{ href: `/trip/${trip.id}/roulette`, label: "Back to the wheel" }} />}
      intro={<DestinationIntro d={d} chosenByWheel />}
      summary={
        <>
          <TripKeyFacts
            distanceKm={rec.route.distanceKm}
            durationMinutes={rec.route.durationMinutes}
            suggested={d.suggestedDurationLabel}
            mapHref={mapHref}
          />
          <TripCostBreakdown cost={rec.cost} />
        </>
      }
    >
      <AttractionList attractions={d.attractions} />
      <ItineraryTimeline
        items={itinerary}
        startLocation={trip.startLocation}
        controls={<DepartureTimeForm tripId={trip.id} current={itinerary.find((i) => i.day === 1 && i.kind === "travel")?.startLocal ?? null} />}
      />
      {/* Server component rendered once per request, so reading the clock here is safe. */}
      {/* eslint-disable-next-line react-hooks/purity */}
      <AccessInfo access={d.access} requiresPermit={d.requiresPermit} now={Date.now()} />
      <SourceList sources={d.sources} />
      <p className="text-sm text-muted">Result ID {trip.spin.publicCode} · Costs, distances and times are estimates.</p>
    </DestinationLayout>
    <TripActionBar trip={saved} />
    <TrackEvent event="destination_viewed" metadata={{ source: "trip", slug: d.slug }} tripId={trip.id} />
    </>
  );
}

function DestinationSkeleton() {
  return (
    <main id="main" aria-busy="true" className="flex-1">
      <p role="status" className="sr-only">
        Loading your destination…
      </p>
      <div aria-hidden="true" className="mx-auto max-w-6xl lg:px-4 lg:pt-6">
        <div className="h-[300px] animate-pulse bg-surface-muted lg:h-[380px] lg:rounded-hero" />
        <div className="flex flex-col gap-3 px-4 pt-5 lg:px-0">
          <div className="h-10 w-48 animate-pulse rounded bg-surface-muted" />
          <div className="h-5 w-64 animate-pulse rounded bg-surface-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-surface-muted" />
        </div>
      </div>
    </main>
  );
}
