import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/button-link";
import { WarnIcon } from "@/components/data-freshness-label";
import { NotAnEditor } from "@/components/admin/not-an-editor";
import { getAdminContext } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Destinations" };

const STATUSES = ["draft", "review", "published", "archived"] as const;
const statusStyle: Record<string, string> = {
  draft: "bg-surface-muted text-ink-soft",
  review: "bg-warn-bg text-warn-label",
  published: "bg-green-tint text-green-ink",
  archived: "bg-surface-muted text-muted line-through",
};

export default function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-16 pt-6">
      <Suspense fallback={<p role="status">Loading destinations…</p>}>
        {searchParams.then((sp) => (
          <Dashboard q={typeof sp.q === "string" ? sp.q : ""} status={typeof sp.status === "string" ? sp.status : ""} due={sp.due === "1"} />
        ))}
      </Suspense>
    </main>
  );
}

async function Dashboard({ q, status, due }: { q: string; status: string; due: boolean }) {
  const ctx = await getAdminContext();
  if (!ctx) return <NotAnEditor />;

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("destinations")
    .select("id, name, slug, publication_status, updated_at, district:districts(name), access_information(is_essential, attraction_id, review_due_at)")
    .order("name");
  if (error) throw new Error(`Destinations read failed: ${error.message}`);

  // Server component rendered per request, so reading the clock here is safe.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const rows = data.map((d) => {
    const essential = (d.access_information ?? []).filter((a) => a.is_essential && a.attraction_id === null);
    return {
      ...d,
      accessDue: essential.length === 0 || essential.some((a) => new Date(a.review_due_at).getTime() < now),
    };
  });
  const counts = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.publication_status === s).length]));
  const dueCount = rows.filter((r) => r.accessDue && r.publication_status === "published").length;
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!needle || r.name.toLowerCase().includes(needle) || r.slug.includes(needle) || (r.district?.name ?? "").toLowerCase().includes(needle)) &&
      (!status || r.publication_status === status) &&
      (!due || r.accessDue),
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Destinations</h1>
          <p className="text-[15px] text-muted">
            {counts.published} published · {counts.review} in review · {counts.draft} draft · {counts.archived} archived
            {dueCount ? ` · ${dueCount} published with access check due (not recommended until re-verified)` : ""}
          </p>
        </div>
        <Link href="/admin/destinations/new" className={`${buttonVariants.primary} h-11 text-[15px]`}>
          New destination
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor="q" className="text-sm font-semibold">
            Search
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Name, slug or district" className="h-11 rounded-xl border-[1.5px] border-line-input px-3" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm font-semibold">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="h-11 rounded-xl border-[1.5px] border-line-input bg-surface px-3">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[15px]">
          <input type="checkbox" name="due" value="1" defaultChecked={due} className="h-5 w-5" /> Access check due
        </label>
        <button type="submit" className={`${buttonVariants.outline} h-11 text-[15px]`}>
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-[15px]">
          <caption className="sr-only">Destinations ({shown.length} shown)</caption>
          <thead>
            <tr className="border-b border-line text-left text-sm text-muted">
              <th scope="col" className="px-4 py-3 font-semibold">Name</th>
              <th scope="col" className="px-4 py-3 font-semibold">District</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Access</th>
              <th scope="col" className="px-4 py-3 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-surface-muted last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  <Link href={`/admin/destinations/${r.id}`}>{r.name}</Link>
                </th>
                <td className="px-4 py-3">{r.district?.name}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-label px-2 py-0.5 text-xs font-semibold ${statusStyle[r.publication_status]}`}>{r.publication_status}</span>
                </td>
                <td className="px-4 py-3">
                  {r.accessDue ? (
                    <span className="flex items-center gap-1.5 text-sm text-warn-label">
                      <WarnIcon /> Access check due
                    </span>
                  ) : (
                    <span className="text-sm text-muted">Current</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted">{formatDate(r.updated_at)}</td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No destinations match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
