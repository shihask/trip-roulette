import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/database.types";

/**
 * Public destination data (published rows only, read with the publishable key under RLS).
 * Cached for hours and tagged so `/api/revalidate` can refresh it after publish/archive (ARCHITECTURE §12).
 */

export type SourceRef = { id: string; name: string; url: string | null; type: string };

export type AccessRecord = {
  id: string;
  restrictionType: string;
  isEssential: boolean;
  status: string;
  details: string;
  validFrom: string | null;
  validUntil: string | null;
  verifiedAt: string;
  reviewDueAt: string;
  attractionName: string | null;
  source: SourceRef | null;
};

export type CostRecord = {
  id: string;
  costType: string;
  label: string;
  unit: string;
  transportMode: string | null;
  amountMinor: number | null;
  minMinor: number | null;
  maxMinor: number | null;
  assumptions: string | null;
  verifiedAt: string | null;
  source: SourceRef | null;
};

export type AttractionRecord = {
  id: string;
  name: string;
  description: string | null;
  activityDurationMinutes: number | null;
  entryFeeMinor: number | null;
  priority: number;
  verifiedAt: string | null;
  source: SourceRef | null;
};

export type DestinationDetail = {
  id: string;
  slug: string;
  name: string;
  district: string;
  type: string;
  shortDescription: string;
  description: string | null;
  latitude: number;
  longitude: number;
  suggestedDurationLabel: string | null;
  bestSeasonMonths: number[] | null;
  requiresPermit: boolean;
  categories: { slug: string; name: string; isPrimary: boolean }[];
  image: { alt: string; credit: string } | null;
  attractions: AttractionRecord[];
  access: AccessRecord[];
  costs: CostRecord[];
  /** Every source cited by the records above, with the latest verification date that cites it. */
  sources: (SourceRef & { lastVerifiedAt: string | null })[];
};

function publicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const SOURCE = "source:information_sources(id, source_name, source_url, source_type)";

type SourceRow = { id: string; source_name: string; source_url: string | null; source_type: string } | null;
const toSource = (s: SourceRow): SourceRef | null => (s ? { id: s.id, name: s.source_name, url: s.source_url, type: s.source_type } : null);

export async function getPublishedSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("destinations");
  const { data, error } = await publicClient().from("destinations").select("slug").eq("publication_status", "published");
  if (error) throw new Error(`Destination list failed: ${error.message}`);
  return data.map((d) => d.slug);
}

export async function getPublishedDestination(slug: string): Promise<DestinationDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("destinations", `destination:${slug}`);

  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return loadDestinationDetail(publicClient(), { slug, publishedOnly: true });
}

/**
 * Uncached loader shared by the public page (publishable key, published only) and the admin preview
 * (editor's session; any status, as RLS allows).
 */
export async function loadDestinationDetail(
  client: SupabaseClient<Database>,
  by: { slug: string; publishedOnly: true } | { id: string; publishedOnly: false },
): Promise<DestinationDetail | null> {
  let query = client
    .from("destinations")
    .select(
      `id, slug, name, destination_type, short_description, description, latitude, longitude,
       suggested_duration_label, best_season_months, requires_permit,
       district:districts(name),
       destination_categories(is_primary, category:categories(slug, name)),
       destination_images(alt_text, credit, is_primary, sort_order),
       attractions(id, name, description, activity_duration_minutes, entry_fee_minor, priority, is_active, verified_at, ${SOURCE}),
       access_information(id, restriction_type, is_essential, status, details, valid_from, valid_until, verified_at, review_due_at,
         attraction:attractions(name), ${SOURCE}),
       destination_costs(id, cost_type, label, unit, transport_mode, amount_minor, minimum_amount_minor, maximum_amount_minor,
         assumptions, verified_at, ${SOURCE})`,
    );
  query = by.publishedOnly ? query.eq("slug", by.slug).eq("publication_status", "published") : query.eq("id", by.id);
  const { data: d, error } = await query.maybeSingle();
  if (error) throw new Error(`Destination read failed: ${error.message}`);
  if (!d) return null;

  const images = [...(d.destination_images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);

  const attractions: AttractionRecord[] = (d.attractions ?? [])
    .filter((a) => a.is_active)
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      activityDurationMinutes: a.activity_duration_minutes,
      entryFeeMinor: a.entry_fee_minor === null ? null : Number(a.entry_fee_minor),
      priority: a.priority,
      verifiedAt: a.verified_at,
      source: toSource(a.source as SourceRow),
    }));

  const access: AccessRecord[] = (d.access_information ?? []).map((a) => ({
    id: a.id,
    restrictionType: a.restriction_type,
    isEssential: a.is_essential,
    status: a.status,
    details: a.details,
    validFrom: a.valid_from,
    validUntil: a.valid_until,
    verifiedAt: a.verified_at,
    reviewDueAt: a.review_due_at,
    attractionName: (a.attraction as { name: string } | null)?.name ?? null,
    source: toSource(a.source as SourceRow),
  }));

  const costs: CostRecord[] = (d.destination_costs ?? []).map((c) => ({
    id: c.id,
    costType: c.cost_type,
    label: c.label,
    unit: c.unit,
    transportMode: c.transport_mode,
    amountMinor: c.amount_minor === null ? null : Number(c.amount_minor),
    minMinor: c.minimum_amount_minor === null ? null : Number(c.minimum_amount_minor),
    maxMinor: c.maximum_amount_minor === null ? null : Number(c.maximum_amount_minor),
    assumptions: c.assumptions,
    verifiedAt: c.verified_at,
    source: toSource(c.source as SourceRow),
  }));

  const sourceMap = new Map<string, SourceRef & { lastVerifiedAt: string | null }>();
  const cite = (s: SourceRef | null, verifiedAt: string | null) => {
    if (!s) return;
    const prev = sourceMap.get(s.id);
    const latest = !prev?.lastVerifiedAt || (verifiedAt && verifiedAt > prev.lastVerifiedAt) ? verifiedAt : prev.lastVerifiedAt;
    sourceMap.set(s.id, { ...s, lastVerifiedAt: latest ?? null });
  };
  access.forEach((a) => cite(a.source, a.verifiedAt));
  costs.forEach((c) => cite(c.source, c.verifiedAt));
  attractions.forEach((a) => cite(a.source, a.verifiedAt));

  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    district: d.district?.name ?? "",
    type: d.destination_type,
    shortDescription: d.short_description,
    description: d.description,
    latitude: Number(d.latitude),
    longitude: Number(d.longitude),
    suggestedDurationLabel: d.suggested_duration_label,
    bestSeasonMonths: d.best_season_months,
    requiresPermit: d.requires_permit,
    categories: (d.destination_categories ?? [])
      .filter((c) => c.category)
      .map((c) => ({ slug: c.category!.slug, name: c.category!.name, isPrimary: c.is_primary })),
    image: images[0] ? { alt: images[0].alt_text, credit: images[0].credit } : null,
    attractions,
    access,
    costs,
    sources: [...sourceMap.values()],
  };
}

const TINTS = ["#5C8A62", "#B07A5A", "#4F7C82", "#6F8A73", "#6F9583", "#5E6B2E"];

/**
 * Browse cards for the homepage and Explore: every published destination, with a freshness label
 * from its essential access records ("Access check due" when one is past review, per ARCHITECTURE §5.2).
 * Freshness is computed when the cache fills (at least hourly).
 */
export async function getBrowseDestinations(): Promise<import("@/components/destination-card").DestinationSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("destinations");
  const { data, error } = await publicClient()
    .from("destinations")
    .select(
      `slug, name, destination_type, district:districts(name),
       destination_categories(is_primary, category:categories(name)),
       destination_images(alt_text, is_primary),
       access_information(is_essential, attraction_id, verified_at, review_due_at)`,
    )
    .eq("publication_status", "published")
    .order("name");
  if (error) throw new Error(`Destination list failed: ${error.message}`);
  const now = Date.now();
  return data.map((d, i) => {
    const essential = (d.access_information ?? []).filter((a) => a.is_essential && a.attraction_id === null);
    const oldest = essential.map((a) => a.verified_at).sort()[0] ?? null;
    const stale = essential.some((a) => new Date(a.review_due_at).getTime() < now);
    const primary = (d.destination_categories ?? []).find((c) => c.is_primary)?.category?.name;
    const image = (d.destination_images ?? []).find((im) => im.is_primary) ?? d.destination_images?.[0];
    return {
      slug: d.slug,
      name: d.name,
      district: d.district?.name ?? "",
      tags: [d.destination_type, ...(primary ? [primary] : [])],
      image: { alt: image?.alt_text ?? `Photo of ${d.name}`, tint: TINTS[i % TINTS.length] },
      freshness: {
        status: essential.length === 0 ? ("unavailable" as const) : stale ? ("review_due" as const) : ("verified" as const),
        lastVerifiedAt: oldest,
      },
    };
  });
}
