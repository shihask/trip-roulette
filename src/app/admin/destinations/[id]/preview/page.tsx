import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAnEditor } from "@/components/admin/not-an-editor";
import { DestinationLayout } from "@/components/destination/destination-layout";
import { AccessInfo, AttractionList, DestinationHero, DestinationIntro, PublicCostTable, PublicKeyFacts, SourceList } from "@/components/destination/sections";
import { getAdminContext } from "@/lib/admin";
import { loadDestinationDetail } from "@/lib/destination-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Preview" };

/** Preview before publishing: the public page as it would look, from the current (unpublished) data. */
export default function PreviewPage({ params }: PageProps<"/admin/destinations/[id]/preview">) {
  return (
    <Suspense fallback={<p role="status" className="p-6">Loading preview…</p>}>
      {params.then(({ id }) => (
        <Preview id={id} />
      ))}
    </Suspense>
  );
}

async function Preview({ id }: { id: string }) {
  const ctx = await getAdminContext();
  if (!ctx) {
    return (
      <main id="main" className="mx-auto w-full max-w-4xl px-4 pt-6">
        <NotAnEditor />
      </main>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await loadDestinationDetail(await getSupabaseServerClient(), { id, publishedOnly: false });
  if (!d) notFound();

  return (
    <>
      <div className="border-b border-warn-border bg-warn-bg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[15px] text-warn-text">
          <p>
            <strong>Preview.</strong> This is how the public page will look. Visitors can&apos;t see it until it&apos;s published.
          </p>
          <Link href={`/admin/destinations/${id}`} className="font-semibold">
            Back to editing
          </Link>
        </div>
      </div>
      <DestinationLayout
        hero={<DestinationHero d={d} />}
        intro={<DestinationIntro d={d} chosenByWheel={false} />}
        summary={
          <>
            <PublicKeyFacts d={d} mapHref={`https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}`} />
            <PublicCostTable costs={d.costs} attractions={d.attractions} />
          </>
        }
      >
        <AttractionList attractions={d.attractions} />
        {/* Server component rendered per request. */}
        {/* eslint-disable-next-line react-hooks/purity */}
        <AccessInfo access={d.access} requiresPermit={d.requiresPermit} now={Date.now()} />
        <SourceList sources={d.sources} />
      </DestinationLayout>
    </>
  );
}
