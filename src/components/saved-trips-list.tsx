"use client";

import Link from "next/link";
import { buttonVariants, ButtonLink } from "@/components/button-link";
import { formatClock, formatDate, formatMoney } from "@/lib/format";
import { removeSavedTrip, useIsClient, useSavedTrips, type SavedTrip } from "@/lib/saved-trips";

/** Saved trips (local list). Reads only this browser's storage, so it works offline. */
export function SavedTripsList() {
  const isClient = useIsClient();
  const trips = useSavedTrips();

  if (!isClient) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <p role="status" className="sr-only">
          Loading saved trips…
        </p>
        <div aria-hidden="true" className="h-40 animate-pulse rounded-card bg-surface-muted" />
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-5">
        <h2 className="text-xl font-bold">No saved trips yet</h2>
        <p className="text-[15px] leading-normal text-muted">
          After the wheel picks a destination, tap Save on the destination page. Saved trips stay in this browser, and you can
          open them without a connection.
        </p>
        <ButtonLink href="/plan" variant="primary">
          Start Your Trip
        </ButtonLink>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {trips.map((t) => (
        <li key={t.tripId}>
          <SavedTripCard trip={t} />
        </li>
      ))}
    </ul>
  );
}

function SavedTripCard({ trip: t }: { trip: SavedTrip }) {
  const headingId = `saved-${t.tripId}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div>
        <h2 id={headingId} className="text-[22px] font-bold">
          {t.destination.name}
        </h2>
        <p className="text-sm text-muted">
          {t.destination.district} · {t.destination.type}
        </p>
      </div>
      <ul className="flex flex-wrap gap-1.5 text-sm">
        {[`From ${t.startTown}`, t.dateLabel, t.durationLabel, `${t.travellerCount} ${t.travellerCount === 1 ? "traveller" : "travellers"} · ${t.transportLabel}`].map(
          (c) => (
            <li key={c} className="rounded-full bg-surface-muted px-2.5 py-1">
              {c}
            </li>
          ),
        )}
      </ul>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">Estimated cost per person</span>
        <span className="text-lg font-bold">{formatMoney(t.cost.perPerson)}</span>
      </p>

      <details className="text-[15px]">
        <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-green">Plan and costs (works offline)</summary>
        <div className="flex flex-col gap-3 pb-2">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Cost estimate per person for {t.destination.name}</caption>
            <tbody>
              {t.cost.lines.map((l) => (
                <tr key={l.label} className="border-b border-surface-muted">
                  <th scope="row" className="py-2 text-left font-normal">
                    {l.label}
                  </th>
                  <td className="py-2 text-right">
                    {formatMoney({ amountMinor: l.minMinor === l.maxMinor ? l.minMinor : null, minMinor: l.minMinor, maxMinor: l.maxMinor })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {t.cost.notIncluded.length ? <p className="text-sm text-muted">Not included: {t.cost.notIncluded.join("; ")}.</p> : null}
          {t.itinerary.length ? (
            <ol className="flex flex-col gap-1.5">
              {t.itinerary.map((i) => (
                <li key={`${i.day}-${i.sequence}`} className="flex gap-3">
                  <span className="w-[72px] flex-none text-sm font-semibold text-green-ink">{i.startLocal ? formatClock(i.startLocal) : ""}</span>
                  <span>{i.title}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="text-sm text-muted">
            {t.accessLastVerifiedAt ? `Access last verified ${formatDate(t.accessLastVerifiedAt)}. ` : ""}
            Saved {formatDate(t.savedAt)}. Information may have changed since; check the official source before travelling.
          </p>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/trip/${t.tripId}/destination`} className={`${buttonVariants.outline} h-11 text-[15px]`}>
          Open trip<span className="sr-only"> to {t.destination.name}</span>
        </Link>
        <button
          type="button"
          onClick={() => removeSavedTrip(t.tripId)}
          className="min-h-11 text-[15px] font-semibold text-error-inline"
        >
          Remove<span className="sr-only"> {t.destination.name} from saved trips</span>
        </button>
        <span className="ml-auto text-xs text-muted">ID {t.publicCode}</span>
      </div>
    </article>
  );
}
