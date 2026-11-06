import type { ReactNode } from "react";
import type { CostSnapshot } from "@shared/cost";
import { WarnIcon } from "@/components/data-freshness-label";
import { Photo } from "@/components/photo";
import type { AccessRecord, AttractionRecord, CostRecord, DestinationDetail } from "@/lib/destination-data";
import { formatClock, formatDate, formatDuration, formatInr, formatMoney, formatMonths } from "@/lib/format";
import type { ItineraryItemView } from "@/lib/trip-data";

const h2 = "text-[22px] font-bold";

export function Section({ id, title, aside, children, className = "" }: { id: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-3.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className={h2}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------

export function DestinationIntro({ d, chosenByWheel }: { d: DestinationDetail; chosenByWheel: boolean }) {
  return (
    <section className="flex flex-col gap-2">
      {chosenByWheel ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-warm-ink">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="#B9461B" strokeWidth="1.6" />
            <path d="M8 1.5V8l5.6 3.2" fill="none" stroke="#B9461B" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          The wheel chose
        </p>
      ) : null}
      <h1 className="text-[38px] font-bold leading-[1.05] tracking-[-0.02em] lg:text-[48px]">{d.name}</h1>
      <p className="text-[15px] text-muted">
        {d.district} district · {d.type}
      </p>
      <ul className="flex flex-wrap gap-1.5 pt-1 text-sm" aria-label="Moods">
        {d.categories.map((c) => (
          <li key={c.slug} className="rounded-full bg-green-tint px-2.5 py-1 text-green-ink">
            {c.name}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 max-w-prose text-base leading-[1.55]">{d.description ?? d.shortDescription}</p>
    </section>
  );
}

export function DestinationHero({ d, back }: { d: DestinationDetail; back?: { href: string; label: string } }) {
  return (
    <div className="relative">
      <Photo
        alt={d.image?.alt || `Photo of ${d.name}`}
        tint="#5C8A62"
        caption={d.image?.credit ? `Photo · ${d.image.credit}` : undefined}
        className="h-[300px] lg:h-[380px] lg:rounded-hero"
      />
      {back ? (
        <a
          href={back.href}
          aria-label={back.label}
          className="absolute left-4 top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface/95 text-ink shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key facts and route link

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}

export function MapLink({ href, label = "Open route in Maps" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M9 16s5-4.6 5-8.5A5 5 0 004 7.5C4 11.4 9 16 9 16z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="9" cy="7.5" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      {label}
      <span className="sr-only"> (opens your maps app or a new tab)</span>
    </a>
  );
}

export function TripKeyFacts({
  distanceKm,
  durationMinutes,
  suggested,
  mapHref,
}: {
  distanceKm: number;
  durationMinutes: number;
  suggested: string | null;
  mapHref: string;
}) {
  return (
    <Section id="facts-h" title="Key travel facts">
      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3">
        <Fact label="Approximate road distance" value={`${Math.round(distanceKm)} km`} />
        <Fact label="Travel time estimate" value={`≈ ${formatDuration(durationMinutes)} each way`} />
        <Fact label="Suggested duration" value={suggested ?? "Not set"} />
      </dl>
      <MapLink href={mapHref} />
    </Section>
  );
}

export function PublicKeyFacts({ d, mapHref }: { d: DestinationDetail; mapHref: string }) {
  return (
    <Section id="facts-h" title="Key facts">
      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4">
        <Fact label="Suggested duration" value={d.suggestedDurationLabel ?? "Not set"} />
        <Fact label="Best season" value={d.bestSeasonMonths?.length ? formatMonths(d.bestSeasonMonths) : "Not known"} />
      </dl>
      <p className="text-sm text-muted">Distance and travel time depend on where you start. Plan a trip to see them.</p>
      <MapLink href={mapHref} label="Open in Maps" />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Costs

const EstimatedChip = () => (
  <span className="rounded-label bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-soft">Estimated</span>
);

export function TripCostBreakdown({ cost }: { cost: CostSnapshot }) {
  return (
    <Section id="cost-h" title="Estimated cost" aside={<span className="text-sm text-muted">Per person</span>}>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">Itemised cost estimate per person</caption>
          <tbody>
            {cost.lines.map((l) => (
              <tr key={l.type + l.label} className="border-b border-surface-muted">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  {l.label}
                  {l.note ? <span className="block text-[13px] text-muted">{l.note}</span> : null}
                </th>
                <td className="py-2.5 text-right align-top tabular-nums">
                  {formatMoney({ amountMinor: l.minMinor === l.maxMinor ? l.minMinor : null, minMinor: l.minMinor, maxMinor: l.maxMinor })}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="pt-3 text-left text-[17px] font-bold">
                Total estimate
              </th>
              <td className="pt-3 text-right text-[17px] font-bold tabular-nums">{formatMoney(cost.perPerson)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <EstimatedChip />
          {cost.travellerCount > 1 ? `About ${formatMoney(cost.groupTotal)} for ${cost.travellerCount} people.` : "For one person."}
        </p>
      </div>
      <p className="text-sm leading-[1.45] text-muted">
        Not included: {cost.notIncluded.join("; ")}.
        {cost.oldestVerifiedAt ? ` Costs last checked ${formatDate(cost.oldestVerifiedAt)}.` : ""}
        {cost.complete ? "" : " Some costs are unknown, so the real total may be higher."}
      </p>
      {cost.assumptions.length ? (
        <details className="text-sm text-muted">
          <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-green">How we estimated this</summary>
          <ul className="list-disc space-y-1 pl-5">
            {cost.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Section>
  );
}

const unitText: Record<string, string> = {
  per_person: "per person",
  per_vehicle: "per vehicle",
  per_group: "per group",
  per_room_night: "per room, per night",
};

export function PublicCostTable({ costs, attractions }: { costs: CostRecord[]; attractions: AttractionRecord[] }) {
  const fees = attractions.filter((a) => a.entryFeeMinor !== null);
  const unknownFees = attractions.filter((a) => a.entryFeeMinor === null);
  const verified = costs.map((c) => c.verifiedAt).filter((v): v is string => Boolean(v)).sort()[0];
  return (
    <Section id="cost-h" title="Typical costs" aside={<EstimatedChip />}>
      {costs.length + fees.length === 0 ? (
        <p className="text-[15px]">Cost info missing. Check the official source before travelling.</p>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">Typical costs at {"this destination"}</caption>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id} className="border-b border-surface-muted last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    {c.label}
                    <span className="block text-[13px] text-muted">
                      {unitText[c.unit] ?? c.unit}
                      {c.transportMode ? ` · ${c.transportMode === "public_transport" ? "public transport" : c.transportMode}` : ""}
                    </span>
                  </th>
                  <td className="py-2.5 text-right align-top tabular-nums">{formatMoney(c)}</td>
                </tr>
              ))}
              {fees.map((a) => (
                <tr key={a.id} className="border-b border-surface-muted last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    Entry: {a.name}
                    <span className="block text-[13px] text-muted">per person</span>
                  </th>
                  <td className="py-2.5 text-right align-top tabular-nums">{a.entryFeeMinor === 0 ? "Free" : formatInr(a.entryFeeMinor!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm leading-[1.45] text-muted">
        Fuel isn&apos;t included: it depends on where you start and how many of you travel. Plan a trip for a full estimate.
        {unknownFees.length ? ` Entry fees not known yet: ${unknownFees.map((a) => a.name).join(", ")}.` : ""}
        {verified ? ` Last checked ${formatDate(verified)}.` : ""}
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Attractions

export function AttractionList({ attractions }: { attractions: AttractionRecord[] }) {
  return (
    <Section id="see-h" title="Attractions & activities">
      {attractions.length === 0 ? (
        <p className="text-[15px] text-muted">No attractions listed yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {attractions.map((a) => {
            const facts = [
              a.activityDurationMinutes ? `About ${formatDuration(a.activityDurationMinutes)}` : null,
              a.entryFeeMinor === null ? "Entry fee not known" : a.entryFeeMinor === 0 ? "Free entry" : `Entry ${formatInr(a.entryFeeMinor)}`,
              a.priority === 1 ? "Main sight" : null,
            ].filter(Boolean);
            return (
              <li key={a.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
                <span aria-hidden="true" className="photo-placeholder h-14 w-14 flex-none rounded-xl" style={{ backgroundColor: "#6F9583" }} />
                <div className="min-w-0">
                  <p className="text-base font-semibold">{a.name}</p>
                  {a.description ? <p className="text-sm text-muted">{a.description}</p> : null}
                  <p className="text-sm text-muted">{facts.join(" · ")}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Itinerary

export function ItineraryTimeline({
  items,
  startLocation,
  controls,
}: {
  items: ItineraryItemView[];
  startLocation: string;
  /** Optional form above the timeline (e.g. the departure time on the trip view). */
  controls?: ReactNode;
}) {
  const days = [...new Set(items.map((i) => i.day))];
  return (
    <Section id="plan-h" title="Suggested itinerary">
      <p className="-mt-1.5 text-sm text-muted">A suggestion, not a booking. Times are estimates; opening hours may differ.</p>
      {items.length > 0 ? controls : null}
      {items.length === 0 ? (
        <p className="text-[15px]">The itinerary isn&apos;t ready yet. Reload the page in a moment.</p>
      ) : (
        days.map((day) => (
          <div key={day} className="flex flex-col gap-1">
            {days.length > 1 ? <h3 className="mb-1 font-body text-base font-semibold">Day {day}</h3> : null}
            <ol className="flex flex-col pl-1">
              {items
                .filter((i) => i.day === day)
                .map((i, idx, arr) => {
                  const last = idx === arr.length - 1;
                  const title =
                    i.kind === "return" && last && i.endLocal ? `${i.title}. Home around ${formatClock(i.endLocal)}` : i.title;
                  return (
                    <li key={i.sequence} className="flex gap-3.5">
                      <div aria-hidden="true" className="flex flex-col items-center">
                        <span className={`mt-1 h-3 w-3 rounded-full ${i.kind === "travel" || i.kind === "return" ? "border-2 border-green bg-surface" : "bg-green"}`} />
                        {last ? null : <span className="w-0.5 flex-1 bg-[#CFE0D6]" />}
                      </div>
                      <div className="pb-[18px]">
                        <p className="text-[13px] font-semibold text-green-ink">
                          {i.startLocal ? formatClock(i.startLocal) : ""}
                          {i.endLocal && !(i.kind === "return" && last) ? ` – ${formatClock(i.endLocal)}` : ""}
                        </p>
                        <p className="mt-0.5 text-base">{title}</p>
                        {i.notes ? <p className="text-sm text-muted">{i.notes}</p> : null}
                      </div>
                    </li>
                  );
                })}
            </ol>
          </div>
        ))
      )}
      <p className="text-sm text-muted">Starts and ends in {startLocation}.</p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Access, permits and safety

const typeLabel: Record<string, string> = {
  general: "Opening status",
  seasonal: "Seasonal",
  permit: "Permits",
  entry: "Entry",
  safety: "Safety",
  road: "Roads",
  transport: "Transport",
  weather: "Weather",
};
const statusLabel: Record<string, string> = {
  open: "Open",
  restricted: "Restricted",
  closed: "Closed",
  advisory: "Advisory",
  unknown: "Status unknown",
};

function validity(a: AccessRecord): string | null {
  if (a.validFrom && a.validUntil) return `${formatDate(a.validFrom)} to ${formatDate(a.validUntil)}`;
  if (a.validFrom) return `From ${formatDate(a.validFrom)}`;
  if (a.validUntil) return `Until ${formatDate(a.validUntil)}`;
  return null;
}

export function AccessInfo({ access, requiresPermit, now }: { access: AccessRecord[]; requiresPermit: boolean; now: number }) {
  const stale = (a: AccessRecord) => new Date(a.reviewDueAt).getTime() < now;
  const notable = access.filter((a) => stale(a) || a.status === "restricted" || a.status === "closed" || a.status === "advisory");
  const routine = access.filter((a) => !notable.includes(a));

  return (
    <Section id="access-h" title="Access, permits & safety">
      {access.length === 0 ? (
        <div className="rounded-xl bg-surface-muted px-3 py-2.5 text-sm leading-[1.4] text-ink-soft">
          Access information unavailable. Check the official source before travelling.
        </div>
      ) : null}

      {notable.map((a) => (
        <div key={a.id} className="flex gap-2.5 rounded-control border border-warn-border bg-warn-bg p-3.5 text-warn-text">
          <span className="mt-0.5">
            <WarnIcon size={18} />
          </span>
          <div>
            <p className="mb-1 font-semibold">
              {stale(a) ? `Access check due — ${(typeLabel[a.restrictionType] ?? a.restrictionType).toLowerCase()}` : `${typeLabel[a.restrictionType] ?? a.restrictionType}: ${statusLabel[a.status] ?? a.status}`}
              {a.attractionName ? ` (${a.attractionName})` : ""}
            </p>
            <p className="text-[15px] leading-[1.45]">{a.details}</p>
            <p className="mt-1 text-sm">
              {validity(a) ? `${validity(a)} · ` : ""}Last verified {formatDate(a.verifiedAt)}. Check the official source before travelling.
            </p>
          </div>
        </div>
      ))}

      {routine.length || requiresPermit ? (
        <ul className="flex flex-col gap-2.5 text-[15px]">
          {requiresPermit && !access.some((a) => a.restrictionType === "permit") ? (
            <li className="flex gap-2.5">
              <span className="w-[90px] flex-none font-semibold">Permits</span>
              <span>A permit is needed. We can&apos;t confirm availability.</span>
            </li>
          ) : null}
          {routine.map((a) => (
            <li key={a.id} className="flex gap-2.5">
              <span className="w-[90px] flex-none font-semibold">{typeLabel[a.restrictionType] ?? a.restrictionType}</span>
              <span>
                {a.details}
                {a.attractionName ? ` (${a.attractionName})` : ""}
                <span className="block text-sm text-muted">
                  {statusLabel[a.status] ?? a.status}
                  {validity(a) ? ` · ${validity(a)}` : ""} · Last verified {formatDate(a.verifiedAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Sources

export function SourceList({ sources }: { sources: DestinationDetail["sources"] }) {
  return (
    <Section id="src-h" title="Sources">
      {sources.length === 0 ? (
        <p className="text-[15px] text-muted">No sources listed yet.</p>
      ) : (
        <ul className="flex flex-col text-[15px]">
          {sources.map((s) => (
            <li key={s.id} className="flex justify-between gap-3 border-b border-line py-3">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span>{s.name}</span>
              )}
              <span className="flex-none text-sm text-muted">{s.lastVerifiedAt ? `Verified ${formatDate(s.lastVerifiedAt)}` : "Not verified"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">Check the official source before travelling.</p>
    </Section>
  );
}
