import type { Metadata } from "next";
import { TripWizard } from "@/components/wizard/trip-wizard";

export const metadata: Metadata = {
  title: "Plan a trip",
  description: "Tell us where you're starting, when, your per-person budget and your mood. We'll shortlist three Kerala destinations that fit.",
};

export default function PlanPage() {
  return <TripWizard />;
}
