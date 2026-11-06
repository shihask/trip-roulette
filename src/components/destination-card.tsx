import Link from "next/link";
import { DataFreshnessLabel, type FreshnessStatus } from "@/components/data-freshness-label";
import { Photo } from "@/components/photo";

export type DestinationSummary = {
  slug: string;
  name: string;
  district: string;
  tags: string[];
  image: { alt: string; tint: string };
  freshness: { status: FreshnessStatus; lastVerifiedAt: string | null };
};

/** Browse card used on the homepage and Explore. */
export function DestinationCard({ destination }: { destination: DestinationSummary }) {
  const { slug, name, district, tags, image, freshness } = destination;
  return (
    <article className="relative overflow-hidden rounded-card border border-line bg-surface">
      <Photo alt={image.alt} tint={image.tint} className="h-[150px]" />
      <div className="flex flex-col gap-2 px-4 pb-4 pt-3.5">
        <h3 className="text-xl font-bold">
          <Link
            href={`/destinations/${slug}`}
            className="text-ink no-underline after:absolute after:inset-0 hover:text-green"
          >
            {name}
          </Link>
        </h3>
        <p className="text-sm text-muted">{[district, ...tags].join(" · ")}</p>
        <DataFreshnessLabel status={freshness.status} lastVerifiedAt={freshness.lastVerifiedAt} />
      </div>
    </article>
  );
}
