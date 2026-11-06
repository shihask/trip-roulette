import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAnEditor } from "@/components/admin/not-an-editor";
import { getAdminContext } from "@/lib/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };

const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/** Changed fields between two snapshots (ignoring timestamps). */
function changes(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return [];
  return Object.keys(after).filter((k) => k !== "updated_at" && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

export default function AuditPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-16 pt-6">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Audit />
      </Suspense>
    </main>
  );
}

async function Audit() {
  const ctx = await getAdminContext();
  if (!ctx) return <NotAnEditor />;
  const db = await getSupabaseServerClient();
  const { data, error } = await db
    .from("admin_audit_log")
    .select("id, admin_user_id, entity_type, entity_id, action, before_snapshot, after_snapshot, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Audit read failed: ${error.message}`);

  return (
    <>
      <div>
        <h1 className="text-[28px] font-bold">Audit log</h1>
        <p className="text-[15px] text-muted">The latest 200 catalogue and configuration changes by editors and admins.</p>
      </div>
      {data.length === 0 ? (
        <p className="text-[15px] text-muted">No changes recorded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {data.map((e) => {
            const before = e.before_snapshot as Record<string, unknown> | null;
            const after = e.after_snapshot as Record<string, unknown> | null;
            const label = String(after?.name ?? after?.label ?? before?.name ?? before?.label ?? e.entity_id);
            const changed = changes(before, after);
            return (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-3">
                <p className="text-[15px]">
                  <span className="font-semibold">{e.action}</span> {e.entity_type.replace(/_/g, " ")}: {label}
                </p>
                <p className="text-sm text-muted">
                  {fmt.format(new Date(e.created_at))} · by {e.admin_user_id === ctx.userId ? "you" : `user ${e.admin_user_id.slice(0, 8)}`}
                  {changed.length ? ` · changed ${changed.join(", ")}` : ""}
                </p>
                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold text-green">Before and after</summary>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <pre className="overflow-x-auto rounded-lg bg-ground p-2 text-xs">{JSON.stringify(before, null, 2) ?? "—"}</pre>
                    <pre className="overflow-x-auto rounded-lg bg-ground p-2 text-xs">{JSON.stringify(after, null, 2) ?? "—"}</pre>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
