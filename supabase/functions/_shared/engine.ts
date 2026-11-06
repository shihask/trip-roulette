/**
 * Recommendation engine (ARCHITECTURE §5). Pure and deterministic: the same catalogue, request and
 * clock give the same result. Eligibility is strict; ranking and diversity only order eligible places.
 * No match score ever leaves the server.
 */
import type { AccessRow, Catalogue, CatalogueDestination, Route } from "./catalogue.ts";
import { type CostSnapshot, type DateWindow, coversWindow, estimateCost, upperBound } from "./cost.ts";
import { formatDate, formatInr } from "./format.ts";
import {
  type CreateTripRequest,
  type DurationCode,
  type TransportMode,
  addDays,
  BUDGET_MAX_MINOR,
  DURATION_CODES,
  TRANSPORT_MODES,
  todayInKolkata,
} from "./trip-request.ts";

export type Warning = { code: string; message: string };

export type ExclusionReason =
  | "no_route"
  | "too_far"
  | "duration_unsuitable"
  | "mood_mismatch"
  | "group_unsuitable"
  | "cost_missing"
  | "over_budget"
  | "access_unverified"
  | "access_stale"
  | "access_closed"
  | "transport_excluded";

export type AccessSnapshot = {
  lastVerifiedAt: string;
  records: { id: string; restrictionType: string; status: string; details: string; verifiedAt: string; reviewDueAt: string }[];
};

export type Eligible = {
  eligible: true;
  destination: CatalogueDestination;
  route: Route;
  cost: CostSnapshot;
  access: AccessSnapshot;
  warnings: Warning[];
};
export type Excluded = { eligible: false; destination: CatalogueDestination; reasons: ExclusionReason[] };
export type Evaluation = Eligible | Excluded;

export type ScoreComponents = Record<"mood" | "budget" | "travelTime" | "group" | "season", { score: number; weight: number }>;

export type Recommendation = Eligible & {
  position: 1 | 2 | 3;
  matchScore: number;
  scoreComponents: ScoreComponents;
  matchReason: string;
};

export type Suggestion = { field: string; value: unknown; label: string; additionalPlaces: number };

export type EngineResult =
  | { ok: true; picks: Recommendation[]; limitedVariety: boolean; window: DateWindow }
  | { ok: false; eligibleCount: number; suggestions: Suggestion[]; exclusionCounts: Partial<Record<ExclusionReason, number>> };

/** Budget presets in paise, used for "Raise budget to …" suggestions (mirrors the wizard). */
export const BUDGET_PRESETS_MINOR = [500_00, 1000_00, 2000_00, 3500_00, 5000_00];

export function tripWindow(req: Pick<CreateTripRequest, "travelDate" | "dateFlexible">, flexibleDays: number, now: Date): DateWindow {
  if (!req.dateFlexible && req.travelDate) return { start: req.travelDate, end: req.travelDate };
  const today = todayInKolkata(now);
  return { start: today, end: addDays(today, Math.max(1, flexibleDays) - 1) };
}

function overlaps(r: AccessRow, w: DateWindow): boolean {
  return (r.validFrom === null || r.validFrom <= w.end) && (r.validUntil === null || r.validUntil >= w.start);
}

const isStale = (r: AccessRow, now: Date) => new Date(r.reviewDueAt).getTime() < now.getTime();

/** Applies every hard constraint (ARCHITECTURE §5.2). Collects all failing reasons. */
export function evaluate(d: CatalogueDestination, req: CreateTripRequest, catalogue: Catalogue, now: Date): Evaluation {
  const reasons: ExclusionReason[] = [];
  const warnings: Warning[] = [];
  const rule = catalogue.durationRules[req.duration];
  const window = tripWindow(req, catalogue.config.flexibleDateWindowDays, now);

  // Route and travel time.
  const route = catalogue.routes.find((r) => r.destinationId === d.id && r.mode === req.transportMode);
  if (!route) reasons.push("no_route");
  else if (!rule || route.durationMinutes > rule.maxOneWayMinutes) reasons.push("too_far");

  if (!d.suitableDurations.includes(req.duration)) reasons.push("duration_unsuitable");
  if (!d.categories.some((c) => req.moods.includes(c.slug))) reasons.push("mood_mismatch");
  if (d.groupSuitability[req.travelGroup] === "not_suitable") reasons.push("group_unsuitable");

  // Essential access (destination level), covering the date or the flexible window.
  const essential = d.access.filter((r) => r.isEssential && r.attractionId === null && overlaps(r, window));
  if (essential.some((r) => isStale(r, now))) reasons.push("access_stale");
  if (essential.some((r) => r.status === "closed")) reasons.push("access_closed");
  const covering = essential.filter((r) => r.status !== "unknown" && coversWindow(r.validFrom, r.validUntil, window));
  if (covering.length === 0) reasons.push("access_unverified");
  for (const r of essential) {
    if (r.status === "restricted" && !isStale(r, now)) {
      warnings.push({ code: "access_restricted", message: `${r.details} Check the official source before travelling.` });
    }
  }
  if (d.requiresPermit) {
    warnings.push({
      code: "permit_required",
      message: "A permit is needed. We can't confirm availability. Check the official source before travelling.",
    });
  }

  // Transport mode excluded by a current record.
  if (d.access.some((r) => !isStale(r, now) && overlaps(r, window) && r.excludedTransportModes.includes(req.transportMode))) {
    reasons.push("transport_excluded");
  }

  // Non-essential information: warn only.
  for (const r of d.access.filter((x) => !x.isEssential && overlaps(x, window))) {
    if (isStale(r, now)) {
      warnings.push({
        code: "access_check_due",
        message: `Access check due: ${r.restrictionType} information last verified ${formatDate(r.verifiedAt)}. Check the official source before travelling.`,
      });
    } else if (r.status === "closed" || r.status === "restricted" || r.status === "advisory") {
      warnings.push({ code: `advisory_${r.restrictionType}`, message: r.details });
    }
  }

  // Cost and budget (strict, inclusive, upper bound of a range).
  let cost: CostSnapshot | null = null;
  if (route && rule) {
    const result = estimateCost({
      destination: d,
      route,
      mode: req.transportMode,
      travellers: req.travellerCount,
      rule,
      overnightStay: req.overnightStay,
      window,
      assumptions: catalogue.assumptions,
    });
    if (!result.ok) reasons.push("cost_missing");
    else {
      cost = result.cost;
      if (upperBound(cost.perPerson) > req.budgetPerPersonMinor) reasons.push("over_budget");
    }
  }

  if (reasons.length > 0 || !route || !cost) return { eligible: false, destination: d, reasons };

  const lastVerifiedAt = covering.map((r) => r.verifiedAt).reduce((a, b) => (a < b ? a : b));
  return {
    eligible: true,
    destination: d,
    route,
    cost,
    warnings,
    access: {
      lastVerifiedAt,
      records: essential.map((r) => ({
        id: r.id,
        restrictionType: r.restrictionType,
        status: r.status,
        details: r.details,
        verifiedAt: r.verifiedAt,
        reviewDueAt: r.reviewDueAt,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Ranking (ARCHITECTURE §5.3)

function curve(share: number, c: { fullScoreAtShare: number; scoreAtLimit: number }): number {
  if (share <= c.fullScoreAtShare) return 1;
  if (share >= 1) return c.scoreAtLimit;
  const t = (share - c.fullScoreAtShare) / (1 - c.fullScoreAtShare);
  return 1 - t * (1 - c.scoreAtLimit);
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function score(e: Eligible, req: CreateTripRequest, catalogue: Catalogue, window: DateWindow): { total: number; components: ScoreComponents } {
  const { weights: w, curves } = catalogue.config;
  const d = e.destination;
  const rule = catalogue.durationRules[req.duration];

  const moodScore =
    req.moods.reduce((s, m) => {
      const c = d.categories.find((x) => x.slug === m);
      return s + (c ? (c.isPrimary ? 1 : 0.7) : 0);
    }, 0) / req.moods.length;
  const budgetScore = curve(upperBound(e.cost.perPerson) / req.budgetPerPersonMinor, curves.budget);
  const timeScore = curve(e.route.durationMinutes / rule.maxOneWayMinutes, curves.travelTime);
  const g = d.groupSuitability[req.travelGroup];
  const groupScore = g === "suitable" ? curves.group.suitable : curves.group.unknown;
  const month = Number(window.start.slice(5, 7));
  const seasonScore =
    d.bestSeasonMonths === null || d.bestSeasonMonths.length === 0
      ? curves.season.unknown
      : d.bestSeasonMonths.includes(month)
        ? curves.season.inSeason
        : curves.season.offSeason;

  const components: ScoreComponents = {
    mood: { score: round3(moodScore), weight: w.mood },
    budget: { score: round3(budgetScore), weight: w.budget },
    travelTime: { score: round3(timeScore), weight: w.travelTime },
    group: { score: round3(groupScore), weight: w.group },
    season: { score: round3(seasonScore), weight: w.season },
  };
  const total = Object.values(components).reduce((s, c) => s + c.score * c.weight, 0);
  return { total: Math.min(1, Math.max(0, round3(total))), components };
}

function distanceKm(a: CatalogueDestination, b: CatalogueDestination): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const primary = (d: CatalogueDestination) => d.categories.find((c) => c.isPrimary)?.slug ?? d.categories[0]?.slug;

// ---------------------------------------------------------------------------
// "Why it matches" (generated from the rules that passed)

const durationPhrase: Record<DurationCode, string> = {
  few_hours: "a few-hours",
  one_day: "a one-day",
  two_days: "a two-day",
  three_to_five_days: "a 3–5 day",
};
const modePhrase: Record<TransportMode, string> = { car: "car", bike: "bike", public_transport: "public transport" };

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export function matchReason(e: Eligible, req: CreateTripRequest): string {
  const matched = e.destination.categories.filter((c) => req.moods.includes(c.slug)).map((c) => c.name.toLowerCase());
  const moods = joinWords(matched);
  const moodText = moods.charAt(0).toUpperCase() + moods.slice(1);
  const fits = upperBound(e.cost.perPerson) < req.budgetPerPersonMinor ? "under" : "within";
  return `${moodText}, fits ${durationPhrase[req.duration]} ${modePhrase[req.transportMode]} trip, ${fits} your ${formatInr(req.budgetPerPersonMinor)} budget.`;
}

// ---------------------------------------------------------------------------
// Main entry

export function eligibleOf(catalogue: Catalogue, req: CreateTripRequest, now: Date): Evaluation[] {
  return catalogue.destinations.map((d) => evaluate(d, req, catalogue, now));
}

export function recommend(catalogue: Catalogue, req: CreateTripRequest, now: Date): EngineResult {
  const evaluations = eligibleOf(catalogue, req, now);
  const eligible = evaluations.filter((e): e is Eligible => e.eligible);

  if (eligible.length < 3) {
    const exclusionCounts: Partial<Record<ExclusionReason, number>> = {};
    for (const e of evaluations) if (!e.eligible) for (const r of e.reasons) exclusionCounts[r] = (exclusionCounts[r] ?? 0) + 1;
    return { ok: false, eligibleCount: eligible.length, suggestions: suggest(catalogue, req, now, eligible.length), exclusionCounts };
  }

  const window = tripWindow(req, catalogue.config.flexibleDateWindowDays, now);
  const ranked = eligible
    .map((e) => ({ e, ...score(e, req, catalogue, window) }))
    .sort((a, b) => b.total - a.total || a.e.destination.name.localeCompare(b.e.destination.name));

  // Diversity (ARCHITECTURE §5.4): prefer a new primary category AND distance; relax step by step.
  const { minDistanceKm, preferDistinctPrimaryCategory } = catalogue.config.diversity;
  const picked: typeof ranked = [ranked[0]];
  let limitedVariety = false;
  while (picked.length < 3) {
    const rest = ranked.filter((r) => !picked.includes(r));
    const newCategory = (r: (typeof ranked)[number]) =>
      !preferDistinctPrimaryCategory || picked.every((p) => primary(p.e.destination) !== primary(r.e.destination));
    const farEnough = (r: (typeof ranked)[number]) => picked.every((p) => distanceKm(p.e.destination, r.e.destination) > minDistanceKm);
    const next =
      rest.find((r) => newCategory(r) && farEnough(r)) ??
      rest.find((r) => newCategory(r) || farEnough(r)) ??
      rest[0];
    if (!(newCategory(next) && farEnough(next))) limitedVariety = true;
    picked.push(next);
  }

  return {
    ok: true,
    window,
    limitedVariety,
    picks: picked.map((p, i) => ({
      ...p.e,
      position: (i + 1) as 1 | 2 | 3,
      matchScore: p.total,
      scoreComponents: p.components,
      matchReason: matchReason(p.e, req),
    })),
  };
}

// ---------------------------------------------------------------------------
// Fewer than three (ARCHITECTURE §5.5). Relax one constraint at a time; never essential access.

function countEligible(catalogue: Catalogue, req: CreateTripRequest, now: Date): number {
  return catalogue.destinations.reduce((n, d) => n + (evaluate(d, req, catalogue, now).eligible ? 1 : 0), 0);
}

export function suggest(catalogue: Catalogue, req: CreateTripRequest, now: Date, eligibleCount: number): Suggestion[] {
  const out: Suggestion[] = [];
  const add = (field: string, value: unknown, label: string, alt: CreateTripRequest) => {
    const more = countEligible(catalogue, alt, now) - eligibleCount;
    if (more > 0) out.push({ field, value, label, additionalPlaces: more });
  };

  // Next duration up.
  const di = DURATION_CODES.indexOf(req.duration);
  const nextDuration = DURATION_CODES[di + 1];
  if (nextDuration && catalogue.durationRules[nextDuration]) {
    const label = catalogue.durationRules[nextDuration].label;
    add("duration", nextDuration, `Change duration to ${label.toLowerCase()}`, {
      ...req,
      duration: nextDuration,
      overnightStay: catalogue.durationRules[nextDuration].nights > 0 ? req.overnightStay : null,
    });
  }

  // Budget: the smallest budget that admits one more place, rounded up to a preset (or ₹500 above them).
  const unlimited = { ...req, budgetPerPersonMinor: BUDGET_MAX_MINOR };
  const costs = catalogue.destinations
    .map((d) => evaluate(d, unlimited, catalogue, now))
    .filter((e): e is Eligible => e.eligible)
    .map((e) => upperBound(e.cost.perPerson))
    .filter((c) => c > req.budgetPerPersonMinor)
    .sort((a, b) => a - b);
  if (costs.length > 0) {
    const needed = costs[0];
    const target = BUDGET_PRESETS_MINOR.find((p) => p >= needed) ?? Math.ceil(needed / 500_00) * 500_00;
    if (target <= BUDGET_MAX_MINOR) {
      add("budgetPerPersonMinor", target, `Raise budget to ${formatInr(target)} per person`, { ...req, budgetPerPersonMinor: target });
    }
  }

  // The extra mood that adds the most places.
  let bestMood: Suggestion | null = null;
  for (const m of catalogue.moods) {
    if (req.moods.includes(m.slug)) continue;
    const moods = [...req.moods, m.slug];
    const more = countEligible(catalogue, { ...req, moods }, now) - eligibleCount;
    if (more > 0 && (!bestMood || more > bestMood.additionalPlaces)) {
      bestMood = { field: "moods", value: moods, label: `Add “${m.name}” as a mood`, additionalPlaces: more };
    }
  }
  if (bestMood) out.push(bestMood);

  // Another transport mode.
  for (const mode of TRANSPORT_MODES) {
    if (mode === req.transportMode) continue;
    add("transportMode", mode, `Travel by ${modePhrase[mode]} instead`, { ...req, transportMode: mode });
  }

  return out.sort((a, b) => b.additionalPlaces - a.additionalPlaces).slice(0, 3);
}
