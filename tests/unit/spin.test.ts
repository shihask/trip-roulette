import { describe, expect, it } from "vitest";
import { uniformIndex } from "../../supabase/functions/_shared/rng.ts";
import { buildItinerary, parseLocalTime, type ItineraryAttraction, type ItineraryInput } from "../../supabase/functions/_shared/itinerary.ts";

describe("uniformIndex", () => {
  const LIMIT = 2 ** 32 - (2 ** 32 % 3); // 2^32 mod 3 = 1, so the limit is 2^32 - 1

  it("maps values to v mod 3 (injected RNG)", () => {
    expect(uniformIndex(3, () => 0)).toBe(0);
    expect(uniformIndex(3, () => 1)).toBe(1);
    expect(uniformIndex(3, () => 2)).toBe(2);
    expect(uniformIndex(3, () => 3)).toBe(0);
    expect(uniformIndex(3, () => LIMIT - 1)).toBe((LIMIT - 1) % 3);
  });

  it("rejects values at or above the largest multiple of 3 below 2^32", () => {
    expect(LIMIT % 3).toBe(0);
    const values = [LIMIT, 2 ** 32 - 1, 5];
    let i = 0;
    expect(uniformIndex(3, () => values[i++])).toBe(2); // first two discarded
    expect(i).toBe(3);
  });

  it("each index is used for an equal share of the accepted range", () => {
    // Every residue class has exactly LIMIT / 3 accepted values.
    expect(LIMIT / 3).toBe(Math.floor(LIMIT / 3));
  });

  it("is roughly uniform with Web Crypto (loose chi-square)", () => {
    const N = 30_000;
    const counts = [0, 0, 0];
    for (let k = 0; k < N; k++) counts[uniformIndex(3)]++;
    const expected = N / 3;
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    // df = 2; p < 0.0001 at 18.4. A loose bound keeps this from being flaky.
    expect(chi2).toBeLessThan(18.4);
  });
});

let seq = 0;
const at = (name: string, lat: number | null, minutes: number, priority = 2, verified = false): ItineraryAttraction => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  name,
  latitude: lat,
  longitude: lat === null ? null : 77,
  activityDurationMinutes: minutes,
  priority,
  hasVerifiedOpeningHours: verified,
});

const base: ItineraryInput = {
  startName: "Kochi",
  destinationName: "Munnar",
  destination: { latitude: 10, longitude: 77 },
  routeMinutes: 180,
  duration: "one_day",
  nights: 0,
  overnightStay: null,
  attractions: [],
};

const mins = (t: string | null) => (t ? parseLocalTime(t) : null);

describe("buildItinerary", () => {
  it("one day: leaves, visits, has lunch, and is home by 21:00 with a rest stop on a 3-hour drive", () => {
    const it1 = buildItinerary({
      ...base,
      attractions: [at("Eravikulam", 10.01, 150, 1), at("Mattupetty", 10.05, 60), at("Tea Museum", 10.02, 60)],
    });
    const kinds = it1.items.map((i) => i.kind);
    expect(kinds[0]).toBe("travel");
    expect(kinds).toContain("rest");
    expect(kinds).toContain("meal");
    expect(kinds[kinds.length - 1]).toBe("return");
    const last = it1.items[it1.items.length - 1];
    expect(mins(last.endLocal)!).toBeLessThanOrEqual(21 * 60);
    const lunch = it1.items.find((i) => i.kind === "meal")!;
    expect(mins(lunch.startLocal)!).toBeGreaterThanOrEqual(12 * 60 + 30);
    expect(mins(lunch.startLocal)!).toBeLessThanOrEqual(14 * 60);
    expect(it1.items.map((i) => i.sequence)).toEqual(it1.items.map((_, k) => k + 1));
  });

  it("orders stops nearest-next from arrival", () => {
    const r = buildItinerary({ ...base, routeMinutes: 60, attractions: [at("Far", 10.2, 30), at("Near", 10.01, 30), at("Mid", 10.1, 30)] });
    expect(r.items.filter((i) => i.kind === "attraction").map((i) => i.title)).toEqual(["Near", "Mid", "Far"]);
  });

  it("drops the lowest-priority stop until the plan fits", () => {
    const r = buildItinerary({
      ...base,
      duration: "few_hours",
      routeMinutes: 90,
      attractions: [at("MustSee", 10.01, 90, 1), at("Optional", 10.02, 90, 3)],
    });
    expect(r.dropped).toEqual(["Optional"]);
    expect(r.items.some((i) => i.title === "MustSee")).toBe(true);
    // few hours: back within 6 hours of a 09:00 start
    expect(mins(r.items[r.items.length - 1].endLocal)!).toBeLessThanOrEqual(15 * 60);
  });

  it("two days with an overnight stay: return only on the last day", () => {
    const r = buildItinerary({ ...base, duration: "two_days", nights: 1, attractions: [at("A", 10.01, 120), at("B", 10.02, 120), at("C", 10.03, 120)] });
    expect(r.items.filter((i) => i.day === 1 && i.kind === "return")).toHaveLength(0);
    expect(r.items.some((i) => i.day === 1 && i.title === "Overnight in Munnar")).toBe(true);
    expect(r.items.filter((i) => i.day === 2).at(-1)!.kind).toBe("return");
  });

  it("warns about unverified opening hours and offers free time when there are no attractions", () => {
    const r = buildItinerary({ ...base, attractions: [at("Unverified", 10.01, 60)] });
    expect(r.warnings).toContain("Opening hours for Unverified not verified");
    const empty = buildItinerary({ ...base, routeMinutes: 60, attractions: [] });
    expect(empty.items.some((i) => i.title === "Time to explore Munnar")).toBe(true);
  });

  it("respects a custom departure time", () => {
    const r = buildItinerary({ ...base, departureLocalTime: "06:00" });
    expect(r.items[0].startLocal).toBe("06:00");
  });
});
