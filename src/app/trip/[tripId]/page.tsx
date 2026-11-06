import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/button-link";
import { RecommendationCard } from "@/components/trip/recommendation-card";
import { RecommendationSummary } from "@/components/trip/recommendation-summary";
import { TripExpired, TripHeader, TripNotFound } from "@/components/trip/trip-shell";
import { getTrip } from "@/lib/trip-data";

export const metadata: Metadata = {
  title: "Your three matches",
  robots: { index: false, follow: false },
};

export default function TripPage({ params }: PageProps<"/trip/[tripId]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TripHeader backHref="/plan" backLabel="Back to preferences" />
      <Suspense fallback={<ResultsSkeleton />}>
        {params.then(({ tripId }) => (
          <TripResults tripId={tripId} />
        ))}
      </Suspense>
    </div>
  );
}

async function TripResults({ tripId }: { tripId: string }) {
  const trip = await getTrip(tripId);
  if (!trip) return <TripNotFound />;
  if (trip.expired && !trip.spin) return <TripExpired />;

  return (
    <>
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[18px] px-4 pb-40 pt-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-bold tracking-[-0.01em] sm:text-[36px]">Your three matches</h1>
          <p className="text-base leading-[1.45] text-muted">
            {trip.spin
              ? "The wheel has already picked one of these."
              : "Look them over, then spin. Each has an equal chance."}
          </p>
        </div>
        <RecommendationSummary trip={trip} />
        <ul className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
          {trip.recommendations.map((rec) => (
            <li key={rec.id} className="flex">
              <div className="flex w-full flex-col [&>article]:flex-1">
                <RecommendationCard rec={rec} />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Costs, distances and travel times are estimates. Check the official source before travelling.
        </p>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-md flex-col gap-2 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3.5">
          <ButtonLink href={`/trip/${trip.id}/roulette`} variant="spin" className="w-full">
            {trip.spin ? "See what the wheel chose" : "Spin to choose"}
          </ButtonLink>
          <p className="text-center text-[13px] text-muted">Equal chance for all three · costs are estimates</p>
        </div>
      </div>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <main id="main" aria-busy="true" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[18px] px-4 pt-5">
      <p role="status" className="sr-only">
        Loading your matches…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-[18px]">
        <div className="h-9 w-64 animate-pulse rounded bg-surface-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[420px] animate-pulse rounded-card bg-surface-muted" />
          ))}
        </div>
      </div>
    </main>
  );
}
