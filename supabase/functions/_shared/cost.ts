/**
 * Cost estimation (ARCHITECTURE §7). Integer paise; per-person lines rounded up to the rupee and
 * the per-person total rounded up to the nearest ₹10. Never a precise number when an essential
 * input is unknown: such a destination gets no estimate (and is not eligible).
 */
import type { Assumption, CatalogueDestination, CostRow, DurationRule, Route } from "./catalogue.ts";
import type { TransportMode } from "./trip-request.ts";
import { formatInr } from "./format.ts";

export type DateWindow = { start: string; end: string };

export type CostLine = {
  type: string;
  label: string;
  minMinor: number;
  maxMinor: number;
  note: string | null;
};

export type Money = { amountMinor: number | null; minMinor: number | null; maxMinor: number | null; currency: "INR" };

export type CostSnapshot = {
  isEstimate: true;
  currency: "INR";
  perPerson: Money;
  groupTotal: Money;
  travellerCount: number;
  lines: CostLine[];
  notIncluded: string[];
  assumptions: string[];
  complete: boolean;
  oldestVerifiedAt: string | null;
};

export type CostInput = {
  destination: CatalogueDestination;
  route: Route;
  mode: TransportMode;
  travellers: number;
  rule: DurationRule;
  overnightStay: boolean | null;
  window: DateWindow;
  assumptions: Record<string, Assumption>;
};

export type CostResult = { ok: true; cost: CostSnapshot } | { ok: false; missing: string };

const ceilRupee = (minor: number) => Math.ceil(minor / 100) * 100;
const ceilTen = (minor: number) => Math.ceil(minor / 1000) * 1000;

function money(lo: number, hi: number): Money {
  return lo === hi
    ? { amountMinor: lo, minMinor: null, maxMinor: null, currency: "INR" }
    : { amountMinor: null, minMinor: lo, maxMinor: hi, currency: "INR" };
}

/** A dated row applies only if its validity covers the whole trip window. */
export function coversWindow(from: string | null, until: string | null, w: DateWindow): boolean {
  return (from === null || from <= w.start) && (until === null || until >= w.end);
}

function rowRange(row: CostRow): [number, number] | null {
  if (row.amountMinor !== null) return [row.amountMinor, row.amountMinor];
  if (row.minMinor !== null && row.maxMinor !== null) return [row.minMinor, row.maxMinor];
  return null;
}

export function estimateCost(input: CostInput): CostResult {
  const { destination: d, route, mode, travellers, rule, window: w, assumptions: A } = input;
  const lines: CostLine[] = [];
  const notes: string[] = [];
  const notIncluded: string[] = [];
  const verified: string[] = [];
  let complete = true;

  const days = rule.nights + 1;
  const stayNights = rule.nights > 0 && input.overnightStay !== false ? rule.nights : 0;
  const roundTrips = rule.nights > 0 && input.overnightStay === false ? days : 1;

  // Vehicles and fuel (car and bike). Fuel inputs are essential.
  let vehicles = 0;
  if (mode === "car" || mode === "bike") {
    const price = A["fuel_price_petrol_minor_per_litre"];
    const kmpl = A[`${mode}_km_per_litre`];
    const seats = A[`${mode}_seats`];
    if (!price || !kmpl || !seats || kmpl.value <= 0 || seats.value <= 0) return { ok: false, missing: "fuel_inputs" };
    vehicles = Math.ceil(travellers / seats.value);
    const km = route.distanceKm * 2 * roundTrips;
    const perPerson = ceilRupee(((km / kmpl.value) * price.value * vehicles) / travellers);
    const vehicleWord = mode === "car" ? (vehicles === 1 ? "car" : "cars") : vehicles === 1 ? "bike" : "bikes";
    lines.push({
      type: "fuel",
      label: "Fuel (shared)",
      minMinor: perPerson,
      maxMinor: perPerson,
      note: `About ${Math.round(km)} km in total, ${vehicles} ${vehicleWord}, split ${travellers} ${travellers === 1 ? "way" : "ways"}`,
    });
    notes.push(`Petrol at ${formatInr(price.value)} a litre; ${kmpl.value} km a litre by ${mode}; ${seats.value} people per ${mode}.`);
    verified.push(price.verifiedAt, kmpl.verifiedAt, seats.verifiedAt);
  }

  // Destination cost rows that apply to this mode.
  const forMode = d.costs.filter((c) => c.transportMode === null || c.transportMode === mode);
  const applicable = forMode.filter((c) => coversWindow(c.validFrom, c.validUntil, w));

  // An essential cost type with rows for this mode but none valid for the dates is unknown.
  const essentialTypes = new Set(forMode.filter((c) => c.isEssential).map((c) => c.costType));
  for (const t of essentialTypes) {
    if (!applicable.some((c) => c.costType === t)) return { ok: false, missing: `cost:${t}` };
  }
  if (mode === "public_transport" && !applicable.some((c) => c.costType === "public_transport")) {
    return { ok: false, missing: "cost:public_transport" };
  }
  if (stayNights > 0 && !applicable.some((c) => c.costType === "accommodation")) {
    return { ok: false, missing: "cost:accommodation" };
  }

  const rooms = Math.ceil(travellers / 2);
  for (const row of applicable) {
    const range = rowRange(row);
    if (!range) {
      if (row.isEssential) return { ok: false, missing: `cost:${row.costType}` };
      continue;
    }
    let factor: number;
    let note: string | null = null;
    switch (row.unit) {
      case "per_person":
        factor = row.costType === "food" ? days : 1;
        if (row.costType === "food" && days > 1) note = `${days} days`;
        break;
      case "per_vehicle":
        if (vehicles === 0) continue;
        factor = (vehicles * days) / travellers;
        note = `${vehicles} ${vehicles === 1 ? "vehicle" : "vehicles"}${days > 1 ? `, ${days} days` : ""}, shared`;
        break;
      case "per_group":
        factor = 1 / travellers;
        note = "Shared by the group";
        break;
      case "per_room_night":
        if (stayNights === 0) continue;
        factor = (stayNights * rooms) / travellers;
        note = `${stayNights} ${stayNights === 1 ? "night" : "nights"}, ${rooms} ${rooms === 1 ? "room" : "rooms"} for ${travellers}`;
        break;
    }
    lines.push({
      type: row.costType,
      label: row.label,
      minMinor: ceilRupee(range[0] * factor),
      maxMinor: ceilRupee(range[1] * factor),
      note,
    });
    if (row.assumptions) notes.push(row.assumptions);
    if (row.verifiedAt) verified.push(row.verifiedAt);
  }

  // Food fallback from cost_assumptions when the destination has no food row.
  if (!applicable.some((c) => c.costType === "food")) {
    const food = A["food_per_person_one_day_minor"];
    if (!food) return { ok: false, missing: "cost:food" };
    const v = ceilRupee(food.value * days);
    lines.push({ type: "food", label: "Food", minMinor: v, maxMinor: v, note: days > 1 ? `${days} days, general estimate` : "General estimate" });
    verified.push(food.verifiedAt);
  }

  // Entry fees: known fees are included; unknown fees are listed as not included.
  const active = d.attractions.filter((a) => a.isActive);
  const known = active.filter((a) => a.entryFeeMinor !== null);
  const unknown = active.filter((a) => a.entryFeeMinor === null);
  const entryTotal = known.reduce((s, a) => s + (a.entryFeeMinor ?? 0), 0);
  if (entryTotal > 0) {
    lines.push({ type: "entry", label: "Entry fees", minMinor: ceilRupee(entryTotal), maxMinor: ceilRupee(entryTotal), note: known.map((a) => a.name).join(", ") });
  }
  if (unknown.length > 0) {
    complete = false;
    notIncluded.push(`Entry fees we don't have yet: ${unknown.map((a) => a.name).join(", ")}`);
  }
  if (stayNights === 0 && rule.nights > 0) notIncluded.push("Accommodation (you chose to come back each day)");
  notIncluded.push("Shopping and personal spending");

  const lo = ceilTen(lines.reduce((s, l) => s + l.minMinor, 0));
  const hi = ceilTen(lines.reduce((s, l) => s + l.maxMinor, 0));

  return {
    ok: true,
    cost: {
      isEstimate: true,
      currency: "INR",
      perPerson: money(lo, hi),
      groupTotal: money(lo * travellers, hi * travellers),
      travellerCount: travellers,
      lines,
      notIncluded,
      assumptions: notes,
      complete,
      oldestVerifiedAt: verified.length ? verified.reduce((a, b) => (a < b ? a : b)) : null,
    },
  };
}

/** The amount that must fit the budget: the upper bound when the estimate is a range. */
export function upperBound(m: Money): number {
  return (m.amountMinor ?? m.maxMinor) as number;
}
