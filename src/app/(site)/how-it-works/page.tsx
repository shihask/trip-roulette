import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/button-link";
import { ContentPage, ContentSection } from "@/components/content-page";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Trip Roulette Kerala picks three destinations that fit your budget, time and mood, and how the wheel decides.",
};

export default function HowItWorksPage() {
  return (
    <ContentPage
      title="How it works"
      lead="Tell us what you have to work with. We find three Kerala destinations that genuinely fit, then the wheel picks one so you don't have to."
    >
      <ContentSection id="step-1" title="1. Tell us your trip">
        <p>
          Pick the town you&apos;re starting from, when you&apos;re going (or that your dates are flexible), how long you
          have, your budget per person, who&apos;s coming, how you&apos;re travelling and the moods you&apos;re after.
        </p>
        <p>No account is needed. When you ask for matches, we start a guest session in this browser so your trip stays yours.</p>
      </ContentSection>

      <ContentSection id="step-2" title="2. See three good matches">
        <p>Every destination we suggest has to pass all of these checks. We never fill the list with places that don&apos;t:</p>
        <ul>
          <li>
            <strong>Budget:</strong> the highest estimate for travel, entry and food (and stays, on longer trips) fits within
            your per-person budget.
          </li>
          <li>
            <strong>Time:</strong> the drive there and back, plus time at the place, fits the trip length you chose.
          </li>
          <li>
            <strong>Mood:</strong> it matches at least one of your moods.
          </li>
          <li>
            <strong>Access:</strong> we hold current, checked information that it&apos;s open for your dates. Places whose
            access check is due aren&apos;t suggested until someone re-checks them.
          </li>
        </ul>
        <p>
          Among the places that pass, we rank by how well they match your moods, budget, travel time, group and the season,
          and we keep the three apart from each other so you get real variety. If fewer than three places fit, we say so and
          suggest which change would open up more options.
        </p>
      </ContentSection>

      <ContentSection id="step-3" title="3. Spin to decide">
        <p>
          Each of your three matches has an equal, one-in-three chance. Our server makes the pick with a secure random
          number generator; the wheel just shows you the result. Each trip gets one spin, so reloading the page shows the
          same result instead of spinning again.
        </p>
      </ContentSection>

      <ContentSection id="step-4" title="4. Plan, save or share">
        <p>
          You get an itemised cost estimate, a suggested day plan you can shift to your departure time, access and safety
          notes with their sources, and a directions link. Save the trip in this browser, or share a link that shows the
          plan without your budget or moods.
        </p>
      </ContentSection>

      <ContentSection id="estimates" title="Estimates, not bookings">
        <p>
          Costs, distances and travel times are estimates from the information we hold, and every record shows when it was
          last checked. Trip Roulette doesn&apos;t take bookings or payments. Always check the official source before you
          travel. See the <Link href="/terms">terms</Link> for details.
        </p>
      </ContentSection>

      <ButtonLink href="/plan" variant="primary" className="self-start">
        Start your trip
      </ButtonLink>
    </ContentPage>
  );
}
