import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DestinationEditor, type EditorData } from "@/components/admin/destination-editor";
import { NotAnEditor } from "@/components/admin/not-an-editor";
import { getAdminContext } from "@/lib/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit destination" };

export default function EditDestinationPage({ params }: PageProps<"/admin/destinations/[id]">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-16 pt-6">
      <Suspense fallback={<p role="status">Loading…</p>}>
        {params.then(({ id }) => (
          <Editor id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function Editor({ id }: { id: string }) {
  const ctx = await getAdminContext();
  if (!ctx) return <NotAnEditor />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getSupabaseServerClient();

  const [dest, districts, categories, destCats, attractions, costs, access, images, routes, locations, sources] = await Promise.all([
    db.from("destinations").select("*").eq("id", id).maybeSingle(),
    db.from("districts").select("id, name").order("name"),
    db.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    db.from("destination_categories").select("category_id, is_primary").eq("destination_id", id),
    db.from("attractions").select("*").eq("destination_id", id).order("priority").order("name"),
    db.from("destination_costs").select("*").eq("destination_id", id).order("cost_type"),
    db.from("access_information").select("*").eq("destination_id", id).order("is_essential", { ascending: false }),
    db.from("destination_images").select("*").eq("destination_id", id).order("sort_order"),
    db.from("location_destination_routes").select("*").eq("destination_id", id),
    db.from("locations").select("id, name").eq("is_active", true).order("name"),
    db.from("information_sources").select("id, source_name").order("source_name"),
  ]);
  for (const r of [dest, districts, categories, destCats, attractions, costs, access, images, routes, locations, sources]) {
    if (r.error) throw new Error(`Editor read failed: ${r.error.message}`);
  }
  if (!dest.data) notFound();

  const data: EditorData = {
    destination: dest.data as unknown as EditorData["destination"],
    districts: districts.data!.map((d) => ({ value: d.id, label: d.name })),
    categories: categories.data!,
    destCategories: destCats.data!,
    attractions: attractions.data!,
    costs: costs.data!,
    access: access.data!,
    images: images.data!,
    routes: routes.data!,
    locations: locations.data!.map((l) => ({ value: l.id, label: l.name })),
    sources: sources.data!.map((s) => ({ value: s.id, label: s.source_name })),
    isAdmin: ctx.role === "admin",
  };

  return (
    <>
      <div>
        <Link href="/admin" className="text-[15px] font-semibold">
          ← All destinations
        </Link>
        <h1 className="mt-2 text-[28px] font-bold">{dest.data.name}</h1>
        <p className="text-sm text-muted">Every change is recorded in the audit log.</p>
      </div>
      <DestinationEditor data={data} />
    </>
  );
}
