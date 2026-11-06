/**
 * generate-itinerary request contract (DATABASE_API_SPEC §8.7). Shared by the Edge Function and the
 * trip destination page. Only the departure time is client-controlled.
 */
import { z } from "zod";

/** Earliest and latest departure the planner accepts (Asia/Kolkata local time). */
export const DEPARTURE_EARLIEST = "04:00";
export const DEPARTURE_LATEST = "14:00";

/** Choices offered in the UI: every 30 minutes from 05:00 to 12:00. */
export const DEPARTURE_CHOICES: string[] = Array.from({ length: 15 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export const departureLocalTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 06:30.")
  .refine((t) => t >= DEPARTURE_EARLIEST && t <= DEPARTURE_LATEST, `Pick a time between ${DEPARTURE_EARLIEST} and ${DEPARTURE_LATEST}.`);

export const generateItineraryRequestSchema = z.object({
  tripId: z.uuid("A valid trip ID is required."),
  departureLocalTime: departureLocalTimeSchema.nullable().optional(),
});

export type GenerateItineraryRequest = z.infer<typeof generateItineraryRequestSchema>;
