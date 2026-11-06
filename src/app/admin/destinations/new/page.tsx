import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DetailsForm } from "@/components/admin/destination-editor";
import { NotAnEditor } from "@/components/admin/not-an-editor";
import { getAdminContext } from "@/lib/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New destination" };

export default function NewDestinationPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-16 pt-6">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <NewDestination />
      </Suspense>
    </main>
  );
}

async function NewDestination() {
  const ctx = await getAdminContext();
  if (!ctx) return <NotAnEditor />;
  const db = await getSupabaseServerClient();
  const { data: districts, error } = await db.from("districts").select("id, name").order("name");
  if (error) throw new Error(`Districts read failed: ${error.message}`);
  return (
    <>
      <div>
        <Link href="/admin" className="text-[15px] font-semibold">
          ← All destinations
        </Link>
        <h1 className="mt-2 text-[28px] font-bold">New destination</h1>
        <p className="text-sm text-muted">It starts as a draft. Add moods, costs, access records, images and routes on the next page.</p>
      </div>
      <DetailsForm
        data={{
          destination: null,
          districts: districts.map((d) => ({ value: d.id, label: d.name })),
          categories: [],
          destCategories: [],
          attractions: [],
          costs: [],
          access: [],
          images: [],
          routes: [],
          locations: [],
          sources: [],
          isAdmin: ctx.role === "admin",
        }}
      />
    </>
  );
}
