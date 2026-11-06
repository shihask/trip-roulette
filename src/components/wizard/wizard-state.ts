import {
  type CreateTripRequest,
  type DurationCode,
  type TransportMode,
  type TravelGroup,
  DURATION_CODES,
  OVERNIGHT_DURATIONS,
  TRANSPORT_MODES,
  TRAVEL_GROUPS,
  TRAVELLERS_MAX,
  TRAVELLERS_MIN,
  groupCountError,
  messages,
  tripRequestFields,
} from "@shared/trip-request";

export type SelectedLocation = { id: string; name: string; district: string };

export type WizardValues = {
  startLocation: SelectedLocation | null;
  dateMode: "specific" | "flexible" | null;
  travelDate: string;
  duration: DurationCode | null;
  /** Whole rupees as typed (kept as text so we never rewrite what the user typed). */
  budgetRupees: string;
  travellerCount: number;
  travelGroup: TravelGroup | null;
  moods: string[];
  transportMode: TransportMode;
  /** null = no preference. Only sent for overnight durations. */
  overnightStay: boolean | null;
};

/** Steps 0–4 are the five questions; 5 is the review. */
export const STEP_COUNT = 5;
export const REVIEW_STEP = 5;
export type Step = 0 | 1 | 2 | 3 | 4 | 5;

export type WizardState = { step: Step; values: WizardValues };

export const initialValues: WizardValues = {
  startLocation: null,
  dateMode: null,
  travelDate: "",
  duration: null,
  budgetRupees: "",
  travellerCount: 2,
  travelGroup: null,
  moods: [],
  transportMode: "car",
  overnightStay: null,
};

export const durationLabels: Record<DurationCode, string> = {
  few_hours: "A few hours",
  one_day: "One day",
  two_days: "Two days",
  three_to_five_days: "3–5 days",
};

export const groupLabels: Record<TravelGroup, string> = {
  solo: "Solo",
  friends: "Friends",
  couple: "Couple",
  family: "Family",
};

export const transportLabels: Record<TransportMode, string> = {
  car: "Car",
  bike: "Bike",
  public_transport: "Public transport",
};

/** Budget presets in rupees per person. Assumption (PRD §12 open question). */
export const BUDGET_PRESETS = [500, 1000, 2000, 3500, 5000] as const;

/** Transport modes with route estimates in the current data. Public transport is not offered yet. */
export const AVAILABLE_TRANSPORT: readonly TransportMode[] = ["car", "bike"];

// ---------------------------------------------------------------------------
// Persistence (sessionStorage: kept while this tab is open, cleared when it closes)

const STORAGE_KEY = "tr.wizard.v1";

export function loadState(): WizardState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state: WizardState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota): the wizard still works in memory.
  }
}

export function clearState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Accept only well-formed stored values; anything odd falls back to the default for that field. */
function sanitize(input: unknown): WizardState | null {
  if (!input || typeof input !== "object") return null;
  const { step, values } = input as { step?: unknown; values?: Record<string, unknown> };
  if (!values || typeof values !== "object") return null;
  const v = values;
  const loc = v.startLocation as Record<string, unknown> | null | undefined;
  const out: WizardValues = {
    startLocation:
      loc && typeof loc.id === "string" && typeof loc.name === "string" && typeof loc.district === "string"
        ? { id: loc.id, name: loc.name, district: loc.district }
        : null,
    dateMode: v.dateMode === "specific" || v.dateMode === "flexible" ? v.dateMode : null,
    travelDate: typeof v.travelDate === "string" ? v.travelDate.slice(0, 10) : "",
    duration: DURATION_CODES.includes(v.duration as DurationCode) ? (v.duration as DurationCode) : null,
    budgetRupees: typeof v.budgetRupees === "string" ? v.budgetRupees.slice(0, 12) : "",
    travellerCount:
      Number.isInteger(v.travellerCount) &&
      (v.travellerCount as number) >= TRAVELLERS_MIN &&
      (v.travellerCount as number) <= TRAVELLERS_MAX
        ? (v.travellerCount as number)
        : initialValues.travellerCount,
    travelGroup: TRAVEL_GROUPS.includes(v.travelGroup as TravelGroup) ? (v.travelGroup as TravelGroup) : null,
    moods: Array.isArray(v.moods) ? v.moods.filter((m): m is string => typeof m === "string").slice(0, 20) : [],
    transportMode: TRANSPORT_MODES.includes(v.transportMode as TransportMode)
      ? (v.transportMode as TransportMode)
      : "car",
    overnightStay: typeof v.overnightStay === "boolean" ? v.overnightStay : null,
  };
  const s = Number(step);
  return { step: (Number.isInteger(s) && s >= 0 && s <= REVIEW_STEP ? s : 0) as Step, values: out };
}

// ---------------------------------------------------------------------------
// Conversion and validation

export function isOvernight(duration: DurationCode | null): boolean {
  return duration !== null && OVERNIGHT_DURATIONS.includes(duration);
}

/** "2,000" or " 2000 " → 200000 paise. Returns NaN for anything that isn't whole rupees. */
export function parseBudgetMinor(text: string): number {
  const cleaned = text.replace(/[\s,₹]/g, "");
  if (!/^\d{1,9}$/.test(cleaned)) return Number.NaN;
  return Number(cleaned) * 100;
}

export function toRequest(v: WizardValues): CreateTripRequest {
  const flexible = v.dateMode === "flexible";
  return {
    startLocationId: v.startLocation?.id ?? "",
    travelDate: flexible || !v.travelDate ? null : v.travelDate,
    dateFlexible: flexible,
    duration: v.duration as DurationCode,
    budgetPerPersonMinor: parseBudgetMinor(v.budgetRupees),
    currency: "INR",
    travellerCount: v.travellerCount,
    travelGroup: v.travelGroup as TravelGroup,
    moods: v.moods,
    transportMode: v.transportMode,
    overnightStay: isOvernight(v.duration) ? v.overnightStay : null,
    accessibilityNeeds: [],
  };
}

export type FieldErrors = Partial<Record<string, string>>;

/** Validates the fields on one step. Keys match the request field names, plus "dateMode". */
export function validateStep(step: Step, v: WizardValues, available: { moodSlugs: string[] }): FieldErrors {
  const fields = tripRequestFields();
  const errors: FieldErrors = {};
  const check = (key: keyof typeof fields, value: unknown) => {
    const r = fields[key].safeParse(value);
    if (!r.success) errors[key] = r.error.issues[0]?.message;
  };

  switch (step) {
    case 0:
      if (!v.startLocation) errors.startLocationId = messages.startLocationId;
      break;
    case 1:
      if (v.dateMode === null) errors.dateMode = "Choose a specific date or “I'm flexible”.";
      else if (v.dateMode === "specific") {
        if (!v.travelDate) errors.travelDate = messages.travelDateMissing;
        else check("travelDate", v.travelDate);
      }
      if (!v.duration) errors.duration = messages.duration;
      break;
    case 2: {
      if (!v.budgetRupees.trim()) errors.budgetPerPersonMinor = messages.budgetMissing;
      else {
        const minor = parseBudgetMinor(v.budgetRupees);
        if (Number.isNaN(minor)) errors.budgetPerPersonMinor = messages.budgetNotWhole;
        else check("budgetPerPersonMinor", minor);
      }
      check("travellerCount", v.travellerCount);
      if (!v.travelGroup) errors.travelGroup = messages.travelGroup;
      else if (!errors.travellerCount) {
        const e = groupCountError(v.travelGroup, v.travellerCount);
        if (e) errors.travellerCount = e;
      }
      break;
    }
    case 3: {
      const known = v.moods.filter((m) => available.moodSlugs.includes(m));
      if (known.length === 0) errors.moods = messages.moods;
      break;
    }
    case 4:
      if (!AVAILABLE_TRANSPORT.includes(v.transportMode)) errors.transportMode = messages.transportMode;
      break;
  }
  return errors;
}

/** Which step a request field lives on (to send server-side field errors back to the right step). */
export const fieldStep: Record<string, Step> = {
  startLocationId: 0,
  dateMode: 1,
  travelDate: 1,
  dateFlexible: 1,
  duration: 1,
  budgetPerPersonMinor: 2,
  travellerCount: 2,
  travelGroup: 2,
  moods: 3,
  transportMode: 4,
  overnightStay: 4,
  accessibilityNeeds: 4,
};
