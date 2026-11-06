import Link from "next/link";
import { formatInr, formatShortDate } from "@/lib/format";
import type { TripView } from "@/lib/trip-data";

const durationLabels = { few_hours: "A few hours", one_day: "One day", two_days: "Two days", three_to_five_days: "3–5 days" } as const;
const groupNoun = { solo: "solo", friends: "friends", couple: "couple", family: "family" } as const;
const modeLabels = { car: "Car", bike: "Bike", public_transport: "Public transport" } as const;

/** Preference chips plus "Adjust preferences" (BUILD_BRIEF §5 RecommendationSummary). */
export function RecommendationSummary({ trip }: { trip: TripView }) {
  const people =
    trip.travelGroup === "solo"
      ? "Solo"
      : trip.travelGroup === "couple"
        ? "Couple"
        : `${trip.travellerCount} ${groupNoun[trip.travelGroup]}`;
  const chips = [
    `From ${trip.startLocation}`,
    trip.dateFlexible || !trip.travelDate ? "Flexible dates" : formatShortDate(trip.travelDate),
    durationLabels[trip.duration],
    `${formatInr(trip.budgetPerPersonMinor)} per person`,
    `${people} · ${modeLabels[trip.transportMode]}`,
  ];

  return (
    <section aria-label="Your preferences" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5">
      <ul className="flex flex-wrap gap-1.5 text-sm">
        {chips.map((c) => (
          <li key={c} className="rounded-full bg-surface-muted px-2.5 py-1">
            {c}
          </li>
        ))}
        {trip.moods.map((m) => (
          <li key={m.slug} className="rounded-full bg-green-tint px-2.5 py-1 text-green-ink">
            {m.name}
          </li>
        ))}
      </ul>
      <Link href="/plan" className="flex min-h-11 items-center self-start text-[15px] font-semibold">
        Adjust preferences
      </Link>
    </section>
  );
}
