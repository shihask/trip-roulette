/**
 * Analytics allow-list (PRD FR-10, DATABASE_API_SPEC §8.9). Shared by `track-event` and the app.
 * Only events that happen in the browser are accepted from clients; the rest are written by the
 * functions that cause them (create-trip, spin, generate-itinerary, create-share-link), so clients
 * can't inflate them. Metadata is strict: no location, no free text.
 */
import { z } from "zod";

const durations = z.enum(["few_hours", "one_day", "two_days", "three_to_five_days"]);
const transport = z.enum(["car", "bike", "public_transport"]);
const group = z.enum(["solo", "couple", "friends", "family"]);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);

export const clientEventMetadata = {
  homepage_view: z.strictObject({}),
  /** `from` is the kind of page the link was on, never the full path. */
  start_trip_clicked: z.strictObject({ from: z.enum(["home", "explore", "destination", "saved", "shared", "trip", "other"]).optional() }),
  preferences_completed: z.strictObject({
    duration: durations,
    transport,
    travel_group: group,
    mood_count: z.number().int().min(1).max(10),
    flexible_date: z.boolean(),
  }),
  roulette_spin_started: z.strictObject({}),
  destination_viewed: z.strictObject({ source: z.enum(["trip", "public"]), slug: slug.optional() }),
  trip_saved: z.strictObject({}),
} as const;

export type ClientEventType = keyof typeof clientEventMetadata;
export const CLIENT_EVENT_TYPES = Object.keys(clientEventMetadata) as ClientEventType[];

export type ClientEventMetadata<E extends ClientEventType> = z.infer<(typeof clientEventMetadata)[E]>;

export const trackEventRequestSchema = z
  .strictObject({
    eventType: z.enum(CLIENT_EVENT_TYPES as [ClientEventType, ...ClientEventType[]]),
    tripId: z.uuid().nullable().optional(),
    /** Random first-party ID kept in the browser; only its hash is stored. */
    anonymousId: z.uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((v, ctx) => {
    const result = clientEventMetadata[v.eventType].safeParse(v.metadata);
    if (!result.success) ctx.addIssue({ code: "custom", path: ["metadata"], message: "Metadata has unknown keys or values." });
  });

export type TrackEventRequest = z.infer<typeof trackEventRequestSchema>;
