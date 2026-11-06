import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using Trip Roulette Kerala, a trip-planning tool that doesn't take bookings.",
};

/*
 * DRAFT. Plain-language terms that match how the service works. Not legal advice: have them reviewed
 * (operator name, governing law, liability wording) before launch.
 */
export default function TermsPage() {
  return (
    <ContentPage
      title="Terms of use"
      lead="Trip Roulette Kerala helps you choose where to go. You stay in charge of the trip."
      notice={
        <>
          <strong>Draft.</strong> These terms haven&apos;t had a legal review yet and may change before launch.
        </>
      }
    >
      <ContentSection id="service" title="What the service is">
        <p>
          Trip Roulette Kerala suggests destinations, estimates costs and travel times, and drafts an itinerary from the
          information we hold. It is free to use. It doesn&apos;t sell, book or reserve travel, stays, tickets or permits, and
          it isn&apos;t an official tourism or government service.
        </p>
      </ContentSection>

      <ContentSection id="estimates" title="Estimates and information">
        <ul>
          <li>
            Costs, distances, travel times and itineraries are estimates. Real prices, fees, traffic and opening hours can
            differ.
          </li>
          <li>
            Access, permit, safety and weather information shows when it was last checked and where it came from. Conditions
            change, sometimes at short notice. Always check the official source before you travel.
          </li>
          <li>
            You decide whether a trip is safe and suitable for you and your group, including for children, older travellers
            and anyone with access needs.
          </li>
        </ul>
      </ContentSection>

      <ContentSection id="spin" title="The wheel">
        <p>
          Each trip gets one spin, and each of the three matches has an equal chance. The result is a suggestion: you&apos;re
          free to go somewhere else.
        </p>
      </ContentSection>

      <ContentSection id="use" title="Fair use">
        <p>Please don&apos;t:</p>
        <ul>
          <li>use automated tools to create trips or spins in bulk, or try to get around request limits;</li>
          <li>try to access other people&apos;s trips, or parts of the service you aren&apos;t meant to reach;</li>
          <li>copy the destination information wholesale to republish it.</li>
        </ul>
        <p>We may limit or block access that harms the service or other people.</p>
      </ContentSection>

      <ContentSection id="sharing" title="Shared links">
        <p>
          Anyone with a shared link can view that copy of the plan until it expires or you turn it off. Share links only with
          people you want to see the plan.
        </p>
      </ContentSection>

      <ContentSection id="availability" title="Availability and changes">
        <p>
          We work to keep the service running and the information accurate, but we can&apos;t promise it will always be
          available, complete or error-free. Trips and links are deleted after the periods set out in the{" "}
          <Link href="/privacy">privacy page</Link>. We may update these terms; the current version is always on this page.
        </p>
      </ContentSection>

      <ContentSection id="photos" title="Photos and sources">
        <p>
          Destination photos belong to their credited owners and are used under their licences. Source links go to other
          sites we don&apos;t control.
        </p>
      </ContentSection>

      <ContentSection id="contact" title="Questions">
        <p>
          Get in touch through the <Link href="/contact">contact page</Link>.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
