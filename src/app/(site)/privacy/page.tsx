import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/content-page";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Trip Roulette Kerala stores, why, and for how long.",
};

/*
 * DRAFT. This page describes what the app actually does today (see docs/3. ARCHITECTURE.md §11, §16).
 * It is not legal advice: have it reviewed (including the Digital Personal Data Protection Act, 2023)
 * and confirm the retention periods before launch. Update it whenever data handling changes.
 */
export default function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy"
      lead="We keep as little as we can, for as short a time as we can."
      notice={
        <>
          <strong>Draft.</strong> This describes how the service works today. It hasn&apos;t had a legal review yet and may
          change before launch.
        </>
      }
    >
      <ContentSection id="summary" title="In short">
        <ul>
          <li>No account, name, email or phone number is needed to plan a trip.</li>
          <li>We never store your precise location.</li>
          <li>Trips are deleted after 90 days; shared links stop working after 30 days, or sooner if you turn them off.</li>
          <li>Saved trips live only in your browser.</li>
          <li>We don&apos;t sell data, show ads, or use advertising trackers.</li>
        </ul>
      </ContentSection>

      <ContentSection id="guest" title="Your guest session">
        <p>
          When you first ask for matches, we create an anonymous guest account and keep its sign-in in a cookie in this
          browser. It lets only you see your trips. It holds no name or contact details. Guest accounts with no remaining
          trips are deleted 90 days after they were created.
        </p>
      </ContentSection>

      <ContentSection id="trips" title="Your trip">
        <p>We store what you enter in the planner so we can find matches and show your trip again:</p>
        <ul>
          <li>starting town, travel date or flexible dates, and trip length;</li>
          <li>budget per person, number of travellers and group type;</li>
          <li>moods, transport, overnight preference and any access needs you select;</li>
          <li>your three matches, the wheel&apos;s result and the suggested itinerary.</li>
        </ul>
        <p>These are deleted automatically 90 days after the trip was created.</p>
      </ContentSection>

      <ContentSection id="location" title="Location">
        <p>
          &ldquo;Use my location&rdquo; asks your browser for your position and uses it, only in your browser, to pick the
          nearest town we support. Your position is never sent to us or stored. We store only the town.
        </p>
      </ContentSection>

      <ContentSection id="sharing" title="Shared links">
        <p>
          A shared link shows a copy of the plan: the destination, start town, dates, trip length, number of travellers,
          transport, the per-person estimate and the itinerary. It never shows your budget, your moods or anything that
          identifies you. Anyone with the link can open it until it expires after 30 days or you turn it off on the trip
          page. Expired links are deleted.
        </p>
      </ContentSection>

      <ContentSection id="browser" title="Stored in your browser">
        <p>
          Saved trips, your place in the planner and recently viewed trip pages are kept in your browser&apos;s storage so
          they work offline. They aren&apos;t sent to us. Clearing your browser data removes them.
        </p>
      </ContentSection>

      <ContentSection id="analytics" title="Usage statistics">
        <p>
          To learn which parts of the service help, we count a short list of actions, such as &ldquo;viewed the
          homepage&rdquo;, &ldquo;finished the planner&rdquo;, &ldquo;spun the wheel&rdquo; and &ldquo;saved a trip&rdquo;.
          These records never include your location or anything you typed. To count returning visitors, your browser keeps a
          random ID; we store only a scrambled (hashed) form of it. If your browser sends a Global Privacy Control or Do Not
          Track signal, it sends us none of these counts and keeps no random ID; actions that happen on our servers (finding
          matches, spinning, sharing) are still counted against the trip. Records are deleted after a year.
        </p>
      </ContentSection>

      <ContentSection id="security" title="Abuse protection">
        <p>
          To stop automated abuse, we count requests per guest and per network address over short periods. In these counts,
          network addresses are stored only in scrambled (hashed) form, and the counts are deleted within a day. Our providers
          also keep standard server logs, including network addresses, for a limited time.
        </p>
      </ContentSection>

      <ContentSection id="providers" title="Who processes it">
        <p>
          Trip data is stored with our database provider, Supabase, in its Mumbai (India) region, and the website is served
          by our hosting provider. Destination photos may load from the photographer&apos;s or publisher&apos;s site. Directions
          open in Google Maps only when you choose to follow that link.
        </p>
        <p>
          When a guest session starts (your first search) or someone signs in to the admin, Cloudflare Turnstile runs a
          short security check to tell people from automated sign-ups. Cloudflare receives technical details about your
          browser and network for that check; it does not see your trip answers.
        </p>
      </ContentSection>

      <ContentSection id="rights" title="Your choices">
        <ul>
          <li>Turn off any shared link from the trip page at any time.</li>
          <li>Remove saved trips from Saved trips, or by clearing your browser data.</li>
          <li>
            Ask us to delete a trip sooner, or ask what we hold, through the <Link href="/contact">contact page</Link>
            {contactEmail ? (
              <>
                {" "}
                (<a href={`mailto:${contactEmail}`}>{contactEmail}</a>)
              </>
            ) : null}
            . Include the trip&apos;s result ID.
          </li>
        </ul>
      </ContentSection>
    </ContentPage>
  );
}
