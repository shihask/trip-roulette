import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/content-page";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Report out-of-date information, ask a question or request deletion of your data.",
};

export default function ContactPage() {
  return (
    <ContentPage title="Contact" lead="Corrections, questions and data requests all come to the same place.">
      <ContentSection id="email" title="Email us">
        {contactEmail ? (
          <p>
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        ) : (
          <p>Our contact address isn&apos;t published yet. It will appear here before launch.</p>
        )}
        <p className="text-[15px] text-muted">We read every message. We can&apos;t take bookings or change reservations.</p>
      </ContentSection>

      <ContentSection id="corrections" title="Reporting out-of-date information">
        <p>To help us check it quickly, include:</p>
        <ul>
          <li>the destination name;</li>
          <li>what&apos;s wrong (for example a fee, opening rule, permit or road closure);</li>
          <li>where you saw the current information, such as an official notice or a visit on a given date.</li>
        </ul>
      </ContentSection>

      <ContentSection id="data" title="Your data">
        <p>
          To ask for your trip data to be deleted, include the result ID shown on your trip (it looks like TR-ABC123). Trip
          links you&apos;ve shared can be turned off yourself from the trip page. See <Link href="/privacy">privacy</Link>{" "}
          for what we keep and for how long.
        </p>
      </ContentSection>

      <ContentSection id="emergency" title="Emergencies">
        <p>
          Trip Roulette can&apos;t help in an emergency. In India, call <a href="tel:112">112</a>.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
