import { describe, expect, it } from "vitest";
import type { AccessRow, Catalogue, CatalogueDestination, CostRow, Route } from "../../supabase/functions/_shared/catalogue.ts";
import { evaluate, recommend, matchReason, type Eligible } from "../../supabase/functions/_shared/engine.ts";
import { estimateCost } from "../../supabase/functions/_shared/cost.ts";
import { createTripRequestSchema, type CreateTripRequest } from "../../supabase/functions/_shared/trip-request.ts";

const NOW = new Date("2026-11-05T06:00:00Z"); // 11:30 IST
const DATE = "2026-11-14";
const past = "2026-10-01T00:00:00Z";
const future = "2027-01-01T00:00:00Z";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function access(over: Partial<AccessRow> = {}): AccessRow {
  return {
    id: id(), attractionId: null, restrictionType: "general", isEssential: true, status: "open",
    excludedTransportModes: [], details: "Open to visitors.", validFrom: null, validUntil: null,
    verifiedAt: "2026-10-29T00:00:00Z", reviewDueAt: future, ...over,
  };
}

function food(over: Partial<CostRow> = {}): CostRow {
  return {
    id: id(), costType: "food", label: "Food", unit: "per_person", transportMode: null,
    amountMinor: 500_00, minMinor: null, maxMinor: null, validFrom: null, validUntil: null,
    isEssential: true, assumptions: null, verifiedAt: "2026-10-29T00:00:00Z", ...over,
  };
}

function dest(name: string, over: Partial<CatalogueDestination> = {}): CatalogueDestination {
  return {
    id: id(), slug: name.toLowerCase().replace(/\s+/g, "-"), name, district: "Idukki", destinationType: "Hill station",
    latitude: 10 + n * 0.5, longitude: 76.5, suitableDurations: ["one_day"], bestSeasonMonths: [11],
    groupSuitability: { friends: "suitable" }, requiresPermit: false,
    categories: [{ slug: "nature", name: "Nature", isPrimary: true }],
    costs: [food()], attractions: [], access: [access()], image: null, ...over,
  };
}

function catalogue(dests: CatalogueDestination[], routeMinutes: Record<string, number> = {}): Catalogue {
  const routes: Route[] = dests.flatMap((d) =>
    (["car", "bike"] as const).map((mode) => ({
      destinationId: d.id, mode, distanceKm: 50, durationMinutes: routeMinutes[d.name] ?? 90, provider: "test", computedAt: past,
    })),
  );
  const a = (value: number) => ({ value, unit: "", verifiedAt: "2026-10-29T00:00:00Z", reviewDueAt: future });
  return {
    destinations: dests,
    routes,
    durationRules: {
      few_hours: { code: "few_hours", label: "A few hours", maxOneWayMinutes: 90, nights: 0 },
      one_day: { code: "one_day", label: "One day", maxOneWayMinutes: 240, nights: 0 },
      two_days: { code: "two_days", label: "Two days", maxOneWayMinutes: 360, nights: 1 },
      three_to_five_days: { code: "three_to_five_days", label: "3–5 days", maxOneWayMinutes: 540, nights: 2 },
    },
    config: {
      version: "1.0.0",
      weights: { mood: 0.3, budget: 0.25, travelTime: 0.2, group: 0.15, season: 0.1 },
      curves: {
        budget: { fullScoreAtShare: 0.7, scoreAtLimit: 0.5 },
        travelTime: { fullScoreAtShare: 0.5, scoreAtLimit: 0.3 },
        season: { inSeason: 1, unknown: 0.5, offSeason: 0.2 },
        group: { suitable: 1, unknown: 0.5, notSuitable: 0 },
      },
      diversity: { minDistanceKm: 15, preferDistinctPrimaryCategory: true },
      flexibleDateWindowDays: 14,
    },
    // 100 km round trip ÷ 20 km/l × ₹100 = ₹500 fuel for one car, split 2 ways = ₹250 each.
    assumptions: {
      fuel_price_petrol_minor_per_litre: a(100_00), car_km_per_litre: a(20), bike_km_per_litre: a(40),
      car_seats: a(4), bike_seats: a(2), food_per_person_one_day_minor: a(500_00),
    },
    moods: [
      { slug: "nature", name: "Nature" }, { slug: "beach", name: "Beach" }, { slug: "culture", name: "Culture" },
      { slug: "relaxation", name: "Relaxation" }, { slug: "wildlife", name: "Wildlife" },
    ],
  };
}

function request(over: Partial<CreateTripRequest> = {}): CreateTripRequest {
  return {
    startLocationId: id(), travelDate: DATE, dateFlexible: false, duration: "one_day",
    budgetPerPersonMinor: 2000_00, currency: "INR", travellerCount: 2, travelGroup: "friends",
    moods: ["nature"], transportMode: "car", overnightStay: null, accessibilityNeeds: [], ...over,
  };
}

const evalOne = (d: CatalogueDestination, req = request(), routeMinutes?: Record<string, number>) =>
  evaluate(d, req, catalogue([d], routeMinutes), NOW);

describe("cost estimate", () => {
  it("adds fuel share and food, rounding the per-person total up to ₹10", () => {
    const d = dest("Munnar");
    const r = evalOne(d) as Eligible;
    expect(r.eligible).toBe(true);
    // ₹250 fuel + ₹500 food = ₹750
    expect(r.cost.perPerson).toEqual({ amountMinor: 750_00, minMinor: null, maxMinor: null, currency: "INR" });
    expect(r.cost.groupTotal.amountMinor).toBe(1500_00);
    expect(r.cost.lines.map((l) => l.type)).toEqual(["fuel", "food"]);
  });

  it("uses two cars for five travellers", () => {
    const d = dest("Munnar");
    const r = evalOne(d, request({ travellerCount: 5 })) as Eligible;
    // 2 cars × ₹500 ÷ 5 = ₹200 fuel each
    expect(r.cost.lines[0].minMinor).toBe(200_00);
  });

  it("reports a range when a cost is a range, and lists unknown entry fees as not included", () => {
    const d = dest("Munnar", {
      costs: [food({ amountMinor: null, minMinor: 400_00, maxMinor: 700_00 })],
      attractions: [{ id: id(), name: "Tea Museum", entryFeeMinor: null, isActive: true }],
    });
    const r = evalOne(d) as Eligible;
    expect(r.cost.perPerson).toMatchObject({ amountMinor: null, minMinor: 650_00, maxMinor: 950_00 });
    expect(r.cost.complete).toBe(false);
    expect(r.cost.notIncluded[0]).toContain("Tea Museum");
  });

  it("includes accommodation for overnight trips, and fails without a stay cost", () => {
    const stay: CostRow = food({ costType: "accommodation", label: "Stay", unit: "per_room_night", amountMinor: 2000_00 });
    const withStay = dest("Wayanad", { suitableDurations: ["two_days"], costs: [food(), stay] });
    const r = evalOne(withStay, request({ duration: "two_days", budgetPerPersonMinor: 5000_00 })) as Eligible;
    // fuel ₹250 + food 2 days ₹1,000 + stay 1 night 1 room ₹2,000 ÷ 2 = ₹1,000 → ₹2,250
    expect(r.cost.perPerson.amountMinor).toBe(2250_00);

    const noStay = dest("Vagamon", { suitableDurations: ["two_days"] });
    const r2 = evalOne(noStay, request({ duration: "two_days", budgetPerPersonMinor: 5000_00 }));
    expect(r2.eligible).toBe(false);
    if (!r2.eligible) expect(r2.reasons).toContain("cost_missing");
  });

  it("fails when fuel inputs are missing", () => {
    const d = dest("Munnar");
    const c = catalogue([d]);
    delete c.assumptions.car_km_per_litre;
    const result = estimateCost({
      destination: d, route: c.routes[0], mode: "car", travellers: 2, rule: c.durationRules.one_day,
      overnightStay: null, window: { start: DATE, end: DATE }, assumptions: c.assumptions,
    });
    expect(result.ok).toBe(false);
  });
});

describe("budget rule (strict, inclusive, upper bound)", () => {
  it("passes when cost equals the budget", () => {
    expect(evalOne(dest("A"), request({ budgetPerPersonMinor: 750_00 })).eligible).toBe(true);
  });
  it("fails when the budget is one rupee below the cost", () => {
    const r = evalOne(dest("A"), request({ budgetPerPersonMinor: 749_00 }));
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reasons).toEqual(["over_budget"]);
  });
  it("fails when the upper bound of a range exceeds the budget", () => {
    const d = dest("A", { costs: [food({ amountMinor: null, minMinor: 400_00, maxMinor: 700_00 })] });
    expect(evalOne(d, request({ budgetPerPersonMinor: 900_00 })).eligible).toBe(false); // max ₹950
    expect(evalOne(d, request({ budgetPerPersonMinor: 950_00 })).eligible).toBe(true);
  });
});

describe("essential access", () => {
  it("excludes when essential access is stale", () => {
    const r = evalOne(dest("A", { access: [access({ reviewDueAt: past })] }));
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reasons).toContain("access_stale");
  });
  it("excludes when there is no essential access record", () => {
    const r = evalOne(dest("A", { access: [access({ isEssential: false })] }));
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reasons).toContain("access_unverified");
  });
  it("excludes when the only essential record has unknown status", () => {
    expect(evalOne(dest("A", { access: [access({ status: "unknown" })] })).eligible).toBe(false);
  });
  it("excludes when an essential record is closed on the date", () => {
    const r = evalOne(dest("A", { access: [access(), access({ restrictionType: "seasonal", status: "closed", validFrom: "2026-11-10", validUntil: "2026-11-20" })] }));
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reasons).toContain("access_closed");
  });
  it("ignores a closure outside the travel date", () => {
    const d = dest("A", { access: [access(), access({ status: "closed", validFrom: "2026-12-01", validUntil: "2026-12-31" })] });
    expect(evalOne(d).eligible).toBe(true);
  });
  it("needs a record covering the whole flexible window", () => {
    const d = dest("A", { access: [access({ validUntil: "2026-11-10" })] });
    expect(evalOne(d).eligible).toBe(false); // trip on the 14th
    expect(evalOne(d, request({ travelDate: null, dateFlexible: true })).eligible).toBe(false); // window 5–18 Nov
    expect(evalOne(d, request({ travelDate: "2026-11-08" })).eligible).toBe(true);
  });
  it("keeps a restricted destination with a warning", () => {
    const r = evalOne(dest("A", { access: [access({ restrictionType: "permit", status: "restricted", details: "Guided trips only." })] })) as Eligible;
    expect(r.eligible).toBe(true);
    expect(r.warnings[0]).toMatchObject({ code: "access_restricted" });
    expect(r.warnings[0].message).toContain("Guided trips only.");
  });
  it("only warns when non-essential information is stale", () => {
    const r = evalOne(dest("A", { access: [access(), access({ isEssential: false, restrictionType: "road", reviewDueAt: past, verifiedAt: "2026-09-02T00:00:00Z" })] })) as Eligible;
    expect(r.eligible).toBe(true);
    expect(r.warnings[0].code).toBe("access_check_due");
    expect(r.warnings[0].message).toContain("2 Sep 2026");
  });
  it("excludes when a current record excludes the transport mode", () => {
    const d = dest("A", { access: [access(), access({ isEssential: false, restrictionType: "road", excludedTransportModes: ["bike"] })] });
    expect(evalOne(d, request({ transportMode: "bike" })).eligible).toBe(false);
    expect(evalOne(d).eligible).toBe(true);
  });
});

describe("other hard constraints", () => {
  it("excludes without a route, too far, wrong duration, no mood overlap, unsuitable group", () => {
    const d = dest("A");
    const c = catalogue([d]);
    c.routes = c.routes.filter((r) => r.mode !== "car");
    const noRoute = evaluate(d, request(), c, NOW);
    expect(!noRoute.eligible && noRoute.reasons).toContain("no_route");

    const far = evalOne(dest("B"), request(), { B: 241 });
    expect(!far.eligible && far.reasons).toContain("too_far");
    expect(evalOne(dest("C"), request(), { C: 240 }).eligible).toBe(true);

    const dur = evalOne(dest("D"), request({ duration: "few_hours" }));
    expect(!dur.eligible && dur.reasons).toContain("duration_unsuitable");

    const mood = evalOne(dest("E"), request({ moods: ["beach"] }));
    expect(!mood.eligible && mood.reasons).toContain("mood_mismatch");

    const group = evalOne(dest("F", { groupSuitability: { friends: "not_suitable" } }));
    expect(!group.eligible && group.reasons).toContain("group_unsuitable");
  });
});

describe("recommend", () => {
  const spread = (name: string, cat: string, lat: number) =>
    dest(name, { latitude: lat, categories: [{ slug: cat, name: cat[0].toUpperCase() + cat.slice(1), isPrimary: true }] });

  it("returns exactly three, positions 1–3, with reasons and no repeats", () => {
    const ds = [spread("A", "nature", 9), spread("B", "beach", 10), spread("C", "culture", 11), spread("D", "nature", 12)];
    const r = recommend(catalogue(ds), request({ moods: ["nature", "beach", "culture"] }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.picks.map((p) => p.position)).toEqual([1, 2, 3]);
    expect(new Set(r.picks.map((p) => p.destination.id)).size).toBe(3);
    expect(r.picks.every((p) => p.matchReason.length > 0)).toBe(true);
  });

  it("prefers a different primary category (diversity), and flags limited variety when it can't", () => {
    const ds = [spread("A", "nature", 9), spread("B", "nature", 10), spread("C", "nature", 11), spread("D", "beach", 12)];
    const r = recommend(catalogue(ds), request({ moods: ["nature", "beach"] }), NOW);
    expect(r.ok && r.picks.some((p) => p.destination.name === "D")).toBe(true);

    const same = [spread("A", "nature", 9), spread("B", "nature", 10), spread("C", "nature", 11)];
    const r2 = recommend(catalogue(same), request(), NOW);
    expect(r2.ok && r2.limitedVariety).toBe(true);
  });

  it("is deterministic", () => {
    const ds = [spread("A", "nature", 9), spread("B", "beach", 10), spread("C", "culture", 11), spread("D", "nature", 12)];
    const req = request({ moods: ["nature", "beach", "culture"] });
    const ids = (r: ReturnType<typeof recommend>) => (r.ok ? r.picks.map((p) => p.destination.id) : []);
    expect(ids(recommend(catalogue(ds), req, NOW))).toEqual(ids(recommend(catalogue(ds), req, NOW)));
  });

  it("returns suggestions, not invented places, when fewer than three fit", () => {
    const ds = [
      spread("A", "wildlife", 9),
      dest("B", { latitude: 10, categories: [{ slug: "nature", name: "Nature", isPrimary: true }] }),
      dest("C", { latitude: 11, categories: [{ slug: "nature", name: "Nature", isPrimary: true }] }),
      dest("Pricey", { latitude: 12, categories: [{ slug: "wildlife", name: "Wildlife", isPrimary: true }], costs: [food({ amountMinor: 1500_00 })] }),
    ];
    const r = recommend(catalogue(ds), request({ moods: ["wildlife"], budgetPerPersonMinor: 1000_00 }), NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.eligibleCount).toBe(1);
    expect(r.suggestions).toContainEqual({ field: "moods", value: ["wildlife", "nature"], label: "Add “Nature” as a mood", additionalPlaces: 2 });
    expect(r.suggestions).toContainEqual({ field: "budgetPerPersonMinor", value: 2000_00, label: "Raise budget to ₹2,000 per person", additionalPlaces: 1 });
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
  });

  it("never suggests relaxing essential access", () => {
    const stale = (name: string, lat: number) => dest(name, { latitude: lat, access: [access({ reviewDueAt: past })] });
    const r = recommend(catalogue([dest("A"), stale("B", 20), stale("C", 21)]), request(), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.suggestions).toEqual([]);
  });
});

describe("match reason", () => {
  it("names the matched moods, duration, mode and budget", () => {
    const d = dest("Munnar", { categories: [{ slug: "nature", name: "Nature", isPrimary: true }, { slug: "relaxation", name: "Relaxation", isPrimary: false }] });
    const r = evalOne(d, request({ moods: ["nature", "relaxation"] })) as Eligible;
    expect(matchReason(r, request({ moods: ["nature", "relaxation"] }))).toBe("Nature and relaxation, fits a one-day car trip, under your ₹2,000 budget.");
  });
});

describe("request schema", () => {
  const schema = createTripRequestSchema(NOW);
  it("accepts the spec example", () => {
    expect(schema.safeParse(request()).success).toBe(true);
  });
  it("rejects a past date, a flexible trip with a date, and unknown fields", () => {
    expect(schema.safeParse(request({ travelDate: "2026-11-04" })).success).toBe(false);
    expect(schema.safeParse(request({ dateFlexible: true })).success).toBe(false);
    expect(schema.safeParse({ ...request(), matchScore: 1 }).success).toBe(false);
  });
  it("rejects solo with two travellers", () => {
    expect(schema.safeParse(request({ travelGroup: "solo" })).success).toBe(false);
  });
});
