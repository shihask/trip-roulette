import type { Metadata } from "next";
import { Suspense } from "react";
import { RouletteWheel } from "@/components/trip/roulette-wheel";
import { TripExpired, TripHeader, TripNotFound } from "@/components/trip/trip-shell";
import { getTrip } from "@/lib/trip-data";

export const metadata: Metadata = {
  title: "Spin to choose",
  robots: { index: false, follow: false },
};

export default function RoulettePage({ params }: PageProps<"/trip/[tripId]/roulette">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<RouletteSkeleton />}>
        {params.then(({ tripId }) => (
          <Roulette tripId={tripId} />
        ))}
      </Suspense>
    </div>
  );
}

async function Roulette({ tripId }: { tripId: string }) {
  const trip = await getTrip(tripId);
  const header = <TripHeader backHref={trip ? `/trip/${trip.id}` : "/plan"} backLabel="Back to your matches" />;
  if (!trip) return <>{header}<TripNotFound /></>;
  // A trip that has already been spun keeps its result, even after expiry.
  if (trip.expired && !trip.spin) return <>{header}<TripExpired /></>;

  return (
    <>
      {header}
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-[18px] px-4 pb-8 pt-4">
        <div className="flex flex-col gap-1.5 self-stretch">
          <h1 className="text-[30px] font-bold tracking-[-0.01em]">Spin to choose</h1>
          <p id="spin-help" className="text-base leading-[1.45] text-muted">
            Each of your three matches has an equal chance. Our server makes the pick; the wheel shows it.
          </p>
        </div>
        <RouletteWheel
          tripId={trip.id}
          segments={trip.recommendations.map((r) => ({ recommendationId: r.id, name: r.destination.name }))}
          initialResult={trip.spin}
        />
      </main>
    </>
  );
}

function RouletteSkeleton() {
  return (
    <>
      <TripHeader backHref="/plan" backLabel="Back to your matches" />
      <main id="main" aria-busy="true" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-[18px] px-4 pt-4">
        <p role="status" className="sr-only">
          Loading the wheel…
        </p>
        <div aria-hidden="true" className="flex w-full flex-col items-center gap-[18px]">
          <div className="h-9 w-56 self-start animate-pulse rounded bg-surface-muted" />
          <div className="mt-[18px] aspect-square w-full max-w-[300px] animate-pulse rounded-full bg-surface-muted" />
          <div className="h-14 w-full animate-pulse rounded-control bg-surface-muted" />
        </div>
      </main>
    </>
  );
}
