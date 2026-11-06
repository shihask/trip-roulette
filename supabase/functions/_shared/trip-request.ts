/**
 * create-trip request contract (docs/4. DATABASE_API_SPEC.md §8.3).
 * Shared by the `create-trip` Edge Function (authoritative validation) and the
 * Next.js wizard (inline validation). Keep this file free of runtime-specific imports.
 */
import { z } from "zod";

export const DURATION_CODES = ["few_hours", "one_day", "two_days", "three_to_five_days"] as const;
export const TRAVEL_GROUPS = ["solo", "friends", "couple", "family"] as const;
export const TRANSPORT_MODES = ["car", "bike", "public_transport"] as const;

export type DurationCode = (typeof DURATION_CODES)[number];
export type TravelGroup = (typeof TRAVEL_GROUPS)[number];
export type TransportMode = (typeof TRANSPORT_MODES)[number];

/** Durations that include at least one night (duration_rules.nights > 0 in the seed). */
export const OVERNIGHT_DURATIONS: readonly DurationCode[] = ["two_days", "three_to_five_days"];

/**
 * Bounds. Traveller count matches the trips table check (1–20).
 * Budget bounds are a product assumption (PRD §12 open question), in paise.
 */
export const TRAVELLERS_MIN = 1;
export const TRAVELLERS_MAX = 20;
export const BUDGET_MIN_MINOR = 100_00; // ₹100
export const BUDGET_MAX_MINOR = 1_00_000_00; // ₹1,00,000
/** How far ahead a specific date may be (days). Assumption; confirm with product. */
export const MAX_DAYS_AHEAD = 365;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function todayInKolkata(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  if (!isoDate.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Field-level messages, also used by the wizard. */
export const messages = {
  startLocationId: "Choose a starting town from the list.",
  travelDateMissing: "Pick a date, or choose “I'm flexible”.",
  travelDateInvalid: "Enter a valid date.",
  travelDatePast: "That date has passed. Pick today or a later date.",
  travelDateTooFar: `Pick a date within the next ${MAX_DAYS_AHEAD} days.`,
  duration: "Choose how long you have.",
  budgetMissing: "Enter a budget per person.",
  budgetNotWhole: "Enter the budget in whole rupees, using digits only.",
  budgetTooLow: `Budget must be at least ₹${BUDGET_MIN_MINOR / 100} per person.`,
  budgetTooHigh: "Budget can be at most ₹1,00,000 per person.",
  travellerCount: `Travellers must be between ${TRAVELLERS_MIN} and ${TRAVELLERS_MAX}.`,
  travelGroup: "Choose who's travelling.",
  soloCount: "A solo trip is for one traveller. Change the group or the number of travellers.",
  coupleCount: "A couple trip is for two travellers. Change the group or the number of travellers.",
  groupCount: "This group needs at least two travellers. Change the group or the number of travellers.",
  moods: "Choose at least one mood to continue.",
  transportMode: "Choose how you'll travel.",
} as const;

/** The group/traveller-count rule, shared so the wizard and server agree. */
export function groupCountError(group: TravelGroup, count: number): string | null {
  if (group === "solo" && count !== 1) return messages.soloCount;
  if (group === "couple" && count !== 2) return messages.coupleCount;
  if ((group === "friends" || group === "family") && count < 2) return messages.groupCount;
  return null;
}

/** Per-field validators. The wizard validates one step at a time with these. */
export function tripRequestFields(now: Date = new Date()) {
  const today = todayInKolkata(now);
  const latest = addDays(today, MAX_DAYS_AHEAD);

  return {
      startLocationId: z.uuid({ error: messages.startLocationId }),
      travelDate: z
        .string()
        .refine(isRealDate, { error: messages.travelDateInvalid })
        .refine((d) => d >= today, { error: messages.travelDatePast })
        .refine((d) => d <= latest, { error: messages.travelDateTooFar })
        .nullable(),
      dateFlexible: z.boolean(),
      duration: z.enum(DURATION_CODES, { error: messages.duration }),
      budgetPerPersonMinor: z
        .number({ error: messages.budgetMissing })
        .int({ error: messages.budgetNotWhole })
        .multipleOf(100, { error: messages.budgetNotWhole })
        .min(BUDGET_MIN_MINOR, { error: messages.budgetTooLow })
        .max(BUDGET_MAX_MINOR, { error: messages.budgetTooHigh }),
      currency: z.literal("INR"),
      travellerCount: z
        .number()
        .int({ error: messages.travellerCount })
        .min(TRAVELLERS_MIN, { error: messages.travellerCount })
        .max(TRAVELLERS_MAX, { error: messages.travellerCount }),
      travelGroup: z.enum(TRAVEL_GROUPS, { error: messages.travelGroup }),
      moods: z
        .array(z.string().regex(/^[a-z0-9-]{1,40}$/))
        .min(1, { error: messages.moods })
        .max(20)
        .refine((m) => new Set(m).size === m.length, { error: "Each mood can be chosen once." }),
      transportMode: z.enum(TRANSPORT_MODES, { error: messages.transportMode }),
      overnightStay: z.boolean().nullable(),
      accessibilityNeeds: z.array(z.string().regex(/^[a-z0-9_-]{1,40}$/)).max(10),
  };
}

/** Full request schema, including the cross-field rules. Authoritative in `create-trip`. */
export function createTripRequestSchema(now: Date = new Date()) {
  return z
    .object(tripRequestFields(now))
    .strict()
    .superRefine((v, ctx) => {
      if (!v.dateFlexible && v.travelDate === null) {
        ctx.addIssue({ code: "custom", path: ["travelDate"], message: messages.travelDateMissing });
      }
      if (v.dateFlexible && v.travelDate !== null) {
        ctx.addIssue({ code: "custom", path: ["travelDate"], message: "A flexible trip has no date." });
      }
      if (v.overnightStay !== null && !OVERNIGHT_DURATIONS.includes(v.duration)) {
        ctx.addIssue({
          code: "custom",
          path: ["overnightStay"],
          message: "An overnight stay only applies to trips of two days or more.",
        });
      }
      const groupError = groupCountError(v.travelGroup, v.travellerCount);
      if (groupError) ctx.addIssue({ code: "custom", path: ["travellerCount"], message: groupError });
    });
}

export type CreateTripRequest = z.infer<ReturnType<typeof createTripRequestSchema>>;

/** Flattens Zod issues into the spec's `fieldErrors` map (first message per field). */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    out[key] ??= issue.message;
  }
  return out;
}
