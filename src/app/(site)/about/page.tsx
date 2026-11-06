import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/content-page";

export const metadata: Metadata = {
  title: "About",
  description: "Trip Roulette Kerala helps you decide where to go in Kerala when you have a budget, a day or two and no plan.",
};

export default function AboutPage() {
  return (
    <ContentPage
      title="About Trip Roulette Kerala"
      lead="For the weekend when you have a budget, some time and no idea where to go."
    >
      <ContentSection id="why" title="Why we built it">
        <p>
          Kerala has more places worth a day trip than anyone can keep track of, but deciding is hard. Travel blogs go out
          of date, fees and opening rules change, and group chats go in circles. Trip Roulette narrows the choice to three
          places that actually fit what you have, then lets a fair spin make the final call.
        </p>
      </ContentSection>

      <ContentSection id="principles" title="What we care about">
        <ul>
          <li>
            <strong>Only real fits.</strong> We never pad the list with places outside your budget or time, or places
            we can&apos;t confirm are open.
          </li>
          <li>
            <strong>Checkable information.</strong> Costs and access notes come with their source and the date they were
            last checked.
          </li>
          <li>
            <strong>A fair spin.</strong> Every match has the same chance, decided on our server, one spin per trip.
          </li>
          <li>
            <strong>Light on your data.</strong> No account, no precise location stored, and trips are deleted after 90
            days. See <Link href="/privacy">privacy</Link>.
          </li>
        </ul>
      </ContentSection>

      <ContentSection id="limits" title="What it isn't">
        <p>
          Trip Roulette is a planning tool. It doesn&apos;t book travel, stays or tickets, and it isn&apos;t an official
          tourism or government service. Check conditions, permits and weather with the official source before you go.
        </p>
      </ContentSection>

      <ContentSection id="contact" title="Spotted something out of date?">
        <p>
          Tell us through the <Link href="/contact">contact page</Link>. Corrections to fees, opening rules and access are
          the most useful thing you can send.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
