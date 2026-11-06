import type { ReactNode } from "react";

/**
 * Destination detail layout (BUILD_BRIEF §6): DOM order is the spec's content order, so phones and
 * screen readers get it as written. On desktop, the summary (key facts + cost) moves to a sticky
 * side column through grid placement; nothing is reordered in the DOM.
 */
export function DestinationLayout({
  hero,
  intro,
  summary,
  children,
  bottomPadding = false,
}: {
  hero: ReactNode;
  intro: ReactNode;
  summary: ReactNode;
  /** Remaining sections, in order (attractions, itinerary, access, sources). */
  children: ReactNode;
  /** Leave room for a fixed bottom bar so it never covers content. */
  bottomPadding?: boolean;
}) {
  return (
    <main id="main" className="flex-1">
      <div className="mx-auto max-w-6xl lg:px-4 lg:pt-6">{hero}</div>
      <div
        className={`mx-auto grid max-w-6xl gap-7 px-4 pt-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-10 lg:pt-8 ${
          bottomPadding ? "pb-36" : "pb-16"
        }`}
      >
        <div className="lg:col-start-1">{intro}</div>
        <aside
          aria-label="Trip summary"
          className="flex flex-col gap-7 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-6 lg:row-start-1 lg:self-start"
        >
          {summary}
        </aside>
        <div className="flex flex-col gap-7 lg:col-start-1">{children}</div>
      </div>
    </main>
  );
}
