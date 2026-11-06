/**
 * Default itinerary (ARCHITECTURE §8). Deterministic; inputs are stored data only. The result is a
 * suggestion: never a booking, never confirmed access.
 *
 * 1. Drop attractions that are inactive or closed on the date.
 * 2. Order by nearest-next from arrival.
 * 3. Activity durations plus 15-minute buffers.
 * 4. Lunch between 12:30 and 14:00; a rest stop on drives over 2.5 hours.
 * 5. The plan must fit the duration (including the drive home); drop the lowest-priority stop until it fits.
 * Times are local (Asia/Kolkata), as minutes from midnight internally.
 */
import type { DurationCode } from "./trip-request.ts";

export type ItineraryAttraction = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  activityDurationMinutes: number | null;
  priority: number;
  hasVerifiedOpeningHours: boolean;
};

export type ItineraryInput = {
  startName: string;
  destinationName: string;
  destination: { latitude: number; longitude: number };
  routeMinutes: number;
  duration: DurationCode;
  nights: number;
  overnightStay: boolean | null;
  /** "HH:MM"; defaults by duration. */
  departureLocalTime?: string;
  /** Active attractions not closed on the date. */
  attractions: ItineraryAttraction[];
};

export type ItineraryItem = {
  day: number;
  sequence: number;
  kind: "travel" | "attraction" | "meal" | "rest" | "return";
  attractionId: string | null;
  title: string;
  startLocal: string;
  endLocal: string | null;
  notes: string | null;
};

export type Itinerary = { items: ItineraryItem[]; warnings: string[]; dropped: string[] };

const BUFFER = 15;
const DEFAULT_ACTIVITY = 60;
const LUNCH_FROM = 12 * 60 + 30;
const LUNCH_LATEST = 14 * 60;
const LUNCH_MINUTES = 45;
const REST_STOP_AFTER = 150;
const REST_STOP_MINUTES = 20;
const HOME_BY = 21 * 60;
const STAY_ACTIVITIES_UNTIL = 18 * 60;
const MORNING_START = 9 * 60;
const FEW_HOURS_TOTAL = 6 * 60;
const TRAVEL_NOTE = "Travel-time estimate; confirm the route before you leave.";

const defaultDeparture: Record<DurationCode, number> = {
  few_hours: 9 * 60,
  one_day: 7 * 60,
  two_days: 7 * 60,
  three_to_five_days: 7 * 60,
};

export function parseLocalTime(t: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) throw new RangeError("time must be HH:MM");
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatLocalTime(minutes: number): string {
  const m = Math.min(Math.max(0, Math.round(minutes)), 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Nearest-next from the destination centre; attractions without coordinates follow, by priority. */
export function orderNearestNext(start: { latitude: number; longitude: number }, list: ItineraryAttraction[]): ItineraryAttraction[] {
  const located = list.filter((a) => a.latitude !== null && a.longitude !== null);
  const rest = list
    .filter((a) => a.latitude === null || a.longitude === null)
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  const out: ItineraryAttraction[] = [];
  let here = start;
  const pool = [...located];
  while (pool.length) {
    pool.sort(
      (a, b) =>
        km(here.latitude, here.longitude, a.latitude!, a.longitude!) - km(here.latitude, here.longitude, b.latitude!, b.longitude!) ||
        a.name.localeCompare(b.name),
    );
    const next = pool.shift()!;
    out.push(next);
    here = { latitude: next.latitude!, longitude: next.longitude! };
  }
  return [...out, ...rest];
}

type DayPlan = { day: number; start: number; activitiesUntil: number; travelOut: boolean; travelBack: boolean; overnight: boolean };

function dayPlans(input: ItineraryInput, departure: number): DayPlan[] {
  const days = input.nights + 1;
  // Door-to-door drive time, including the rest stop on long drives.
  const route = input.routeMinutes + (input.routeMinutes > REST_STOP_AFTER ? REST_STOP_MINUTES : 0);
  if (input.nights === 0 || input.overnightStay === false) {
    // Day trips: out and back each day.
    const homeBy = input.duration === "few_hours" ? departure + FEW_HOURS_TOTAL : HOME_BY;
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      start: departure,
      activitiesUntil: homeBy - route - BUFFER,
      travelOut: true,
      travelBack: true,
      overnight: false,
    }));
  }
  return Array.from({ length: days }, (_, i) => {
    const first = i === 0;
    const last = i === days - 1;
    return {
      day: i + 1,
      start: first ? departure : MORNING_START,
      activitiesUntil: last ? HOME_BY - route - BUFFER : STAY_ACTIVITIES_UNTIL,
      travelOut: first,
      travelBack: last,
      overnight: !last,
    };
  });
}

/** Lays out the stops in order across the days. Returns the items and the stops that didn't fit. */
function layout(input: ItineraryInput, plans: DayPlan[], stops: ItineraryAttraction[]) {
  const items: Omit<ItineraryItem, "sequence">[] = [];
  const queue = [...stops];
  const unplaced: ItineraryAttraction[] = [];
  const route = input.routeMinutes;

  for (const plan of plans) {
    let t = plan.start;
    let lunch = false;
    let placedToday = 0;

    const travel = (kind: "travel" | "return", from: string, to: string) => {
      if (route > REST_STOP_AFTER) {
        const half = ceil5(route / 2);
        items.push({ day: plan.day, kind, attractionId: null, title: `Drive from ${from} towards ${to}`, startLocal: formatLocalTime(t), endLocal: formatLocalTime(t + half), notes: TRAVEL_NOTE });
        t += half;
        items.push({ day: plan.day, kind: "rest", attractionId: null, title: "Rest stop", startLocal: formatLocalTime(t), endLocal: formatLocalTime(t + REST_STOP_MINUTES), notes: null });
        t += REST_STOP_MINUTES;
        items.push({ day: plan.day, kind, attractionId: null, title: `Continue to ${to}`, startLocal: formatLocalTime(t), endLocal: formatLocalTime(t + route - half), notes: TRAVEL_NOTE });
        t += route - half;
      } else {
        items.push({ day: plan.day, kind, attractionId: null, title: `Drive from ${from} to ${to}`, startLocal: formatLocalTime(t), endLocal: formatLocalTime(t + route), notes: TRAVEL_NOTE });
        t += route;
      }
    };

    const maybeLunch = (nextEnd: number) => {
      if (lunch) return;
      const crossesLunch = t >= LUNCH_FROM || nextEnd > LUNCH_LATEST;
      if (!crossesLunch) return;
      const start = Math.max(t, LUNCH_FROM);
      if (start > LUNCH_LATEST || start + LUNCH_MINUTES > plan.activitiesUntil) return;
      items.push({ day: plan.day, kind: "meal", attractionId: null, title: "Lunch", startLocal: formatLocalTime(start), endLocal: formatLocalTime(start + LUNCH_MINUTES), notes: null });
      t = start + LUNCH_MINUTES;
      lunch = true;
    };

    if (plan.travelOut) travel("travel", input.startName, input.destinationName);

    while (queue.length) {
      const a = queue[0];
      const dur = a.activityDurationMinutes ?? DEFAULT_ACTIVITY;
      maybeLunch(t + BUFFER + dur);
      if (t + BUFFER + dur > plan.activitiesUntil) break;
      queue.shift();
      t += BUFFER;
      items.push({
        day: plan.day,
        kind: "attraction",
        attractionId: a.id,
        title: a.name,
        startLocal: formatLocalTime(t),
        endLocal: formatLocalTime(t + dur),
        notes: a.hasVerifiedOpeningHours ? null : "Opening hours not verified. Check before you go.",
      });
      t += dur;
      placedToday++;
    }

    // Free time when nothing fits but there's room (common for short trips).
    if (placedToday === 0 && plan.activitiesUntil - t >= 30 + BUFFER) {
      const end = Math.min(plan.activitiesUntil, t + BUFFER + 120);
      maybeLunch(end);
      if (plan.activitiesUntil - t >= 30 + BUFFER) {
        const until = Math.min(plan.activitiesUntil, t + BUFFER + 120);
        items.push({ day: plan.day, kind: "attraction", attractionId: null, title: `Time to explore ${input.destinationName}`, startLocal: formatLocalTime(t + BUFFER), endLocal: formatLocalTime(until), notes: null });
        t = until;
      }
    }
    maybeLunch(t);

    if (plan.overnight) {
      items.push({ day: plan.day, kind: "rest", attractionId: null, title: `Overnight in ${input.destinationName}`, startLocal: formatLocalTime(Math.max(t, 18 * 60 + 30)), endLocal: null, notes: "Accommodation not booked. Arrange your own stay." });
    }
    if (plan.travelBack) {
      t += BUFFER;
      travel("return", input.destinationName, input.startName);
    }
  }
  unplaced.push(...queue);
  return { items, unplaced };
}

const ceil5 = (m: number) => Math.ceil(m / 5) * 5;

export function buildItinerary(raw: ItineraryInput): Itinerary {
  // Times are estimates: round drive and activity lengths up to 5 minutes so no time looks precise.
  const input: ItineraryInput = {
    ...raw,
    routeMinutes: ceil5(raw.routeMinutes),
    attractions: raw.attractions.map((a) => ({
      ...a,
      activityDurationMinutes: a.activityDurationMinutes === null ? null : ceil5(a.activityDurationMinutes),
    })),
  };
  const departure = input.departureLocalTime ? parseLocalTime(input.departureLocalTime) : defaultDeparture[input.duration];
  const plans = dayPlans(input, departure);
  let stops = orderNearestNext(input.destination, input.attractions);
  const dropped: string[] = [];

  // Drop the lowest-priority stop (then the longest, then by name) until everything fits.
  let result = layout(input, plans, stops);
  while (result.unplaced.length > 0) {
    const victim = [...stops].sort(
      (a, b) =>
        b.priority - a.priority ||
        (b.activityDurationMinutes ?? DEFAULT_ACTIVITY) - (a.activityDurationMinutes ?? DEFAULT_ACTIVITY) ||
        a.name.localeCompare(b.name),
    )[0];
    dropped.push(victim.name);
    stops = stops.filter((s) => s.id !== victim.id);
    result = layout(input, plans, stops);
  }

  const counters = new Map<number, number>();
  const items: ItineraryItem[] = result.items.map((it) => {
    const seq = (counters.get(it.day) ?? 0) + 1;
    counters.set(it.day, seq);
    return { ...it, sequence: seq };
  });

  const warnings = [
    ...stops.filter((s) => !s.hasVerifiedOpeningHours).map((s) => `Opening hours for ${s.name} not verified`),
    ...dropped.map((name) => `${name} left out: not enough time on this trip`),
  ];
  return { items, warnings, dropped };
}
