import Link from "next/link";
import { DataFreshnessLabel, WarnIcon } from "@/components/data-freshness-label";
import { Photo } from "@/components/photo";
import { formatDuration, formatMoney } from "@/lib/format";
import type { TripRecommendationView } from "@/lib/trip-data";

const TINTS = ["#5C8A62", "#4F7C82", "#6F8A73", "#6F9583", "#5E6B2E"];

function tintFor(slug: string): string {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** One of the three recommendations. No match score, ever. */
export function RecommendationCard({ rec }: { rec: TripRecommendationView }) {
  const d = rec.destination;
  const headingId = `rec-${rec.position}-h`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <Photo alt={d.imageAlt || `Photo of ${d.name}`} tint={tintFor(d.slug)} className="h-[168px]" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h2 id={headingId} className="mb-1 text-[22px] font-bold">
            {d.name}
          </h2>
          <p className="text-sm text-muted">{[d.district, d.type].filter(Boolean).join(" · ")}</p>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          <div>
            <dt className="text-xs text-muted">Road distance</dt>
            <dd className="mt-0.5 text-[15px] font-semibold">
              <span aria-hidden="true">≈ </span>
              <span className="sr-only">Approximately </span>
              {Math.round(rec.route.distanceKm)} km
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Travel time</dt>
            <dd className="mt-0.5 text-[15px] font-semibold">
              <span aria-hidden="true">≈ </span>
              <span className="sr-only">About </span>
              {formatDuration(rec.route.durationMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Est. per person</dt>
            <dd className="mt-0.5 text-[15px] font-semibold">{formatMoney(rec.cost.perPerson)}</dd>
          </div>
        </dl>

        <div className="rounded-xl bg-ground p-3">
          <p className="mb-1 text-[13px] font-semibold text-green-ink">Why it matches</p>
          <p className="text-sm leading-[1.45]">{rec.matchReason}</p>
        </div>

        {rec.warnings.map((w) => (
          <div key={w.code + w.message} className="flex items-start gap-2 rounded-xl border border-warn-border bg-warn-bg px-3 py-2.5">
            <span className="mt-0.5">
              <WarnIcon size={16} />
            </span>
            <p className="text-sm leading-[1.4] text-warn-text">{w.message}</p>
          </div>
        ))}

        <DataFreshnessLabel status="verified" lastVerifiedAt={rec.lastVerifiedAt} prefix="Access last verified" />

        <Link href={`/destinations/${d.slug}`} className="mt-auto text-[15px] font-semibold">
          View details<span className="sr-only"> about {d.name}</span>
        </Link>
      </div>
    </article>
  );
}
