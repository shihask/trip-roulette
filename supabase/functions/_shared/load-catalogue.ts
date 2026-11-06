/**
 * Loads everything create-trip needs, using the service-role client (RLS bypassed, so every query
 * filters to published / active rows explicitly). The catalogue is small; one round of queries.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AlgorithmConfig, Assumption, Catalogue, CatalogueDestination, DurationRule, Route } from "./catalogue.ts";
import type { DurationCode, TransportMode } from "./trip-request.ts";

const curve = z.object({ fullScoreAtShare: z.number().min(0).max(1), scoreAtLimit: z.number().min(0).max(1) });
const configSchema = z.object({
  version: z.string(),
  weights: z.object({ mood: z.number(), budget: z.number(), travelTime: z.number(), group: z.number(), season: z.number() }),
  curves: z.object({
    budget: curve,
    travelTime: curve,
    season: z.object({ inSeason: z.number(), unknown: z.number(), offSeason: z.number() }),
    group: z.object({ suitable: z.number(), unknown: z.number(), notSuitable: z.number() }),
  }),
  diversity: z.object({ minDistanceKm: z.number().min(0), preferDistinctPrimaryCategory: z.boolean() }),
  flexibleDateWindowDays: z.number().int().min(1),
});

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// Rows from untyped nested selects; mapped field by field below.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export async function loadCatalogue(db: SupabaseClient, startLocationId: string): Promise<Catalogue> {
  const [dests, routes, rules, config, assumptions, moods] = await Promise.all([
    db
      .from("destinations")
      .select(
        `id, slug, name, destination_type, latitude, longitude, suitable_durations, best_season_months,
         group_suitability, requires_permit,
         district:districts(name),
         destination_categories(is_primary, category:categories(slug, name, is_active)),
         destination_costs(id, cost_type, label, unit, transport_mode, amount_minor, minimum_amount_minor,
           maximum_amount_minor, valid_from, valid_until, is_essential, assumptions, verified_at),
         attractions(id, name, entry_fee_minor, is_active),
         access_information(id, attraction_id, restriction_type, is_essential, status, excluded_transport_modes,
           details, valid_from, valid_until, verified_at, review_due_at),
         destination_images(storage_path, external_url, alt_text, credit, is_primary, sort_order)`,
      )
      .eq("publication_status", "published"),
    db
      .from("location_destination_routes")
      .select("destination_id, transport_mode, distance_km, duration_minutes, provider, computed_at")
      .eq("location_id", startLocationId),
    db.from("duration_rules").select("duration_code, label, max_one_way_minutes, nights"),
    db.from("algorithm_configs").select("version, weights, curves, diversity, flexible_date_window_days").eq("is_active", true).single(),
    db.from("cost_assumptions").select("key, value, unit, verified_at, review_due_at"),
    db.from("categories").select("slug, name").eq("is_active", true).order("sort_order"),
  ]);

  for (const r of [dests, routes, rules, config, assumptions, moods]) {
    if (r.error) throw new Error(`catalogue load failed: ${r.error.message}`);
  }

  const destinations: CatalogueDestination[] = (dests.data as Row[]).map((d) => {
    const images = [...(d.destination_images ?? [])].sort(
      (a: Row, b: Row) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
    );
    const img = images[0];
    return {
      id: d.id,
      slug: d.slug,
      name: d.name,
      district: d.district?.name ?? "",
      destinationType: d.destination_type,
      latitude: Number(d.latitude),
      longitude: Number(d.longitude),
      suitableDurations: d.suitable_durations,
      bestSeasonMonths: d.best_season_months,
      groupSuitability: d.group_suitability ?? {},
      requiresPermit: d.requires_permit,
      categories: (d.destination_categories ?? [])
        .filter((c: Row) => c.category?.is_active)
        .map((c: Row) => ({ slug: c.category.slug, name: c.category.name, isPrimary: c.is_primary })),
      costs: (d.destination_costs ?? []).map((c: Row) => ({
        id: c.id,
        costType: c.cost_type,
        label: c.label,
        unit: c.unit,
        transportMode: c.transport_mode,
        amountMinor: num(c.amount_minor),
        minMinor: num(c.minimum_amount_minor),
        maxMinor: num(c.maximum_amount_minor),
        validFrom: c.valid_from,
        validUntil: c.valid_until,
        isEssential: c.is_essential,
        assumptions: c.assumptions,
        verifiedAt: c.verified_at,
      })),
      attractions: (d.attractions ?? []).map((a: Row) => ({
        id: a.id,
        name: a.name,
        entryFeeMinor: num(a.entry_fee_minor),
        isActive: a.is_active,
      })),
      access: (d.access_information ?? []).map((a: Row) => ({
        id: a.id,
        attractionId: a.attraction_id,
        restrictionType: a.restriction_type,
        isEssential: a.is_essential,
        status: a.status,
        excludedTransportModes: a.excluded_transport_modes ?? [],
        details: a.details,
        validFrom: a.valid_from,
        validUntil: a.valid_until,
        verifiedAt: a.verified_at,
        reviewDueAt: a.review_due_at,
      })),
      image: img
        ? { storagePath: img.storage_path, externalUrl: img.external_url, alt: img.alt_text, credit: img.credit }
        : null,
    };
  });

  const routeList: Route[] = (routes.data as Row[]).map((r) => ({
    destinationId: r.destination_id,
    mode: r.transport_mode as TransportMode,
    distanceKm: Number(r.distance_km),
    durationMinutes: Number(r.duration_minutes),
    provider: r.provider,
    computedAt: r.computed_at,
  }));

  const durationRules = Object.fromEntries(
    (rules.data as Row[]).map((r) => [
      r.duration_code,
      { code: r.duration_code, label: r.label, maxOneWayMinutes: r.max_one_way_minutes, nights: r.nights } satisfies DurationRule,
    ]),
  ) as Record<DurationCode, DurationRule>;

  const c = config.data as Row;
  const parsedConfig: AlgorithmConfig = configSchema.parse({
    version: c.version,
    weights: c.weights,
    curves: c.curves,
    diversity: c.diversity,
    flexibleDateWindowDays: c.flexible_date_window_days,
  });

  const assumptionMap: Record<string, Assumption> = Object.fromEntries(
    (assumptions.data as Row[]).map((a) => [a.key, { value: Number(a.value), unit: a.unit, verifiedAt: a.verified_at, reviewDueAt: a.review_due_at }]),
  );

  return {
    destinations,
    routes: routeList,
    durationRules,
    config: parsedConfig,
    assumptions: assumptionMap,
    moods: moods.data as { slug: string; name: string }[],
  };
}
