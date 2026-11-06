"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { buttonVariants } from "@/components/button-link";
import { formatDate, formatInr } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { inputClass, labelClass } from "./admin-ui";
import { RecordTable, type Option, type Row, type TableConfig } from "./record-table";

const DURATIONS = [
  { value: "few_hours", label: "A few hours" },
  { value: "one_day", label: "One day" },
  { value: "two_days", label: "Two days" },
  { value: "three_to_five_days", label: "3–5 days" },
];
const GROUPS = ["solo", "friends", "couple", "family"] as const;
const SUITABILITY = [
  { value: "suitable", label: "Suitable" },
  { value: "unknown", label: "Unknown" },
  { value: "not_suitable", label: "Not suitable" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MODES = [
  { value: "car", label: "Car" },
  { value: "bike", label: "Bike" },
  { value: "public_transport", label: "Public transport" },
];

export const detailsSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/, "Use lower-case letters, digits and hyphens (e.g. fort-kochi)."),
  district_id: z.uuid({ error: "Choose a district." }),
  destination_type: z.string().trim().min(2, "Type is required, e.g. Hill station.").max(60),
  short_description: z.string().trim().min(10, "Write at least a short sentence (10+ characters).").max(200, "Keep it under 200 characters."),
  description: z.string().trim().max(4000).nullable(),
  latitude: z.number({ error: "Latitude must be a number." }).min(8, "Kerala latitudes are between 8 and 13.").max(13, "Kerala latitudes are between 8 and 13."),
  longitude: z.number({ error: "Longitude must be a number." }).min(74, "Kerala longitudes are between 74 and 78.").max(78, "Kerala longitudes are between 74 and 78."),
  suitable_durations: z.array(z.enum(["few_hours", "one_day", "two_days", "three_to_five_days"])).min(1, "Choose at least one duration."),
  suggested_duration_label: z.string().trim().max(60).nullable(),
  best_season_months: z.array(z.number().int().min(1).max(12)).nullable(),
  group_suitability: z.record(z.string(), z.enum(["suitable", "unknown", "not_suitable"])),
  requires_permit: z.boolean(),
  accessibility_notes: z.string().trim().max(1000).nullable(),
});
export type DestinationDetails = z.infer<typeof detailsSchema>;

type DestRow = DestinationDetails & { id: string; publication_status: string; updated_at: string };

export type EditorData = {
  destination: DestRow | null;
  districts: Option[];
  categories: { id: string; name: string }[];
  destCategories: { category_id: string; is_primary: boolean }[];
  attractions: Row[];
  costs: Row[];
  access: Row[];
  images: Row[];
  routes: Row[];
  locations: Option[];
  sources: Option[];
  isAdmin: boolean;
};

const emptyOr = (s: string) => (s.trim() === "" ? null : s.trim());

// ---------------------------------------------------------------------------

export function DetailsForm({ data }: { data: EditorData }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const d = data.destination;
  const [v, setV] = useState({
    name: d?.name ?? "",
    slug: d?.slug ?? "",
    district_id: d?.district_id ?? "",
    destination_type: d?.destination_type ?? "",
    short_description: d?.short_description ?? "",
    description: d?.description ?? "",
    latitude: d ? String(d.latitude) : "",
    longitude: d ? String(d.longitude) : "",
    suitable_durations: (d?.suitable_durations ?? []) as string[],
    suggested_duration_label: d?.suggested_duration_label ?? "",
    best_season_months: (d?.best_season_months ?? []) as number[],
    group_suitability: (d?.group_suitability ?? Object.fromEntries(GROUPS.map((g) => [g, "unknown"]))) as Record<string, string>,
    requires_permit: d?.requires_permit ?? false,
    accessibility_notes: d?.accessibility_notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = detailsSchema.safeParse({
      ...v,
      description: emptyOr(v.description),
      suggested_duration_label: emptyOr(v.suggested_duration_label),
      accessibility_notes: emptyOr(v.accessibility_notes),
      latitude: v.latitude.trim() === "" ? undefined : Number(v.latitude),
      longitude: v.longitude.trim() === "" ? undefined : Number(v.longitude),
      best_season_months: v.best_season_months.length ? [...v.best_season_months].sort((a, b) => a - b) : null,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(errs)[0]}"]`)?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    const db = getSupabaseBrowserClient();
    const result = d
      ? await db.from("destinations").update(parsed.data).eq("id", d.id).select("id").single()
      : await db.from("destinations").insert({ ...parsed.data, publication_status: "draft" }).select("id").single();
    setBusy(false);
    if (result.error) {
      setMessage(result.error.code === "23505" ? "That slug is already used by another destination." : `Couldn't save: ${result.error.message}`);
      return;
    }
    if (!d) {
      router.push(`/admin/destinations/${result.data.id}`);
      return;
    }
    setMessage("Details saved.");
    router.refresh();
  }

  const field = (name: keyof typeof v, label: string, opts: { textarea?: boolean; hint?: string; optional?: boolean } = {}) => {
    const err = errors[name];
    const id = `d-${name}`;
    return (
      <div className={`flex flex-col gap-1 ${opts.textarea ? "sm:col-span-2" : ""}`}>
        <label htmlFor={id} className={labelClass}>
          {label}
          {opts.optional ? <span className="font-normal text-muted"> (optional)</span> : null}
        </label>
        {opts.textarea ? (
          <textarea id={id} name={name} rows={4} value={String(v[name])} onChange={(e) => setV({ ...v, [name]: e.target.value })} aria-invalid={Boolean(err)} aria-describedby={err ? `${id}-err` : undefined} className={`${inputClass} h-auto py-2`} />
        ) : (
          <input id={id} name={name} value={String(v[name])} onChange={(e) => setV({ ...v, [name]: e.target.value })} aria-invalid={Boolean(err)} aria-describedby={[opts.hint ? `${id}-hint` : "", err ? `${id}-err` : ""].join(" ").trim() || undefined} className={inputClass} />
        )}
        {opts.hint ? <p id={`${id}-hint`} className="text-xs text-muted">{opts.hint}</p> : null}
        {err ? <p id={`${id}-err`} className="text-sm font-medium text-error-inline">{err}</p> : null}
      </div>
    );
  };

  return (
    <form ref={formRef} onSubmit={save} noValidate className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xl font-bold">Details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("name", "Name")}
        {field("slug", "Slug", { hint: "Used in the address: /destinations/<slug>" })}
        <div className="flex flex-col gap-1">
          <label htmlFor="d-district_id" className={labelClass}>District</label>
          <select id="d-district_id" name="district_id" value={v.district_id} onChange={(e) => setV({ ...v, district_id: e.target.value })} aria-invalid={Boolean(errors.district_id)} className={inputClass}>
            <option value="">Choose…</option>
            {data.districts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {errors.district_id ? <p className="text-sm font-medium text-error-inline">{errors.district_id}</p> : null}
        </div>
        {field("destination_type", "Type", { hint: "Display label, e.g. Hill station" })}
        {field("short_description", "Short description", { textarea: true })}
        {field("description", "Description", { textarea: true, optional: true, hint: "Required before publishing." })}
        {field("latitude", "Latitude")}
        {field("longitude", "Longitude")}
        {field("suggested_duration_label", "Suggested duration label", { optional: true, hint: "e.g. 1 long day" })}
        {field("accessibility_notes", "Accessibility notes", { optional: true })}
      </div>

      <fieldset>
        <legend className={labelClass}>Suitable durations</legend>
        <div className="flex flex-wrap gap-x-4">
          {DURATIONS.map((o) => (
            <label key={o.value} className="flex min-h-11 items-center gap-2 text-[15px]">
              <input type="checkbox" name="suitable_durations" className="h-5 w-5" checked={v.suitable_durations.includes(o.value)} onChange={(e) => setV({ ...v, suitable_durations: e.target.checked ? [...v.suitable_durations, o.value] : v.suitable_durations.filter((x) => x !== o.value) })} />
              {o.label}
            </label>
          ))}
        </div>
        {errors.suitable_durations ? <p className="text-sm font-medium text-error-inline">{errors.suitable_durations}</p> : null}
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Best season <span className="font-normal text-muted">(none = unknown)</span></legend>
        <div className="flex flex-wrap gap-x-3">
          {MONTHS.map((m, i) => (
            <label key={m} className="flex min-h-11 items-center gap-1.5 text-[15px]">
              <input type="checkbox" className="h-5 w-5" checked={v.best_season_months.includes(i + 1)} onChange={(e) => setV({ ...v, best_season_months: e.target.checked ? [...v.best_season_months, i + 1] : v.best_season_months.filter((x) => x !== i + 1) })} />
              {m}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className={`${labelClass} mb-1`}>Group suitability</legend>
        {GROUPS.map((g) => (
          <div key={g} className="flex flex-col gap-1">
            <label htmlFor={`d-group-${g}`} className="text-sm">{g[0].toUpperCase() + g.slice(1)}</label>
            <select id={`d-group-${g}`} value={v.group_suitability[g] ?? "unknown"} onChange={(e) => setV({ ...v, group_suitability: { ...v.group_suitability, [g]: e.target.value } })} className={inputClass}>
              {SUITABILITY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </fieldset>

      <label className="flex min-h-11 items-center gap-2 text-[15px]">
        <input type="checkbox" className="h-5 w-5" checked={v.requires_permit} onChange={(e) => setV({ ...v, requires_permit: e.target.checked })} />
        Requires a permit
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={`${buttonVariants.primary} h-11 text-[15px] disabled:opacity-70`}>
          {busy ? "Saving…" : d ? "Save details" : "Create draft"}
        </button>
        <p role="status" className="text-sm text-muted">{message}</p>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function CategoryEditor({ data }: { data: EditorData }) {
  const router = useRouter();
  const destId = data.destination!.id;
  const [selected, setSelected] = useState<string[]>(data.destCategories.map((c) => c.category_id));
  const [primary, setPrimary] = useState<string>(data.destCategories.find((c) => c.is_primary)?.category_id ?? "");
  const [message, setMessage] = useState("");

  async function save() {
    if (selected.length === 0 || !primary || !selected.includes(primary)) {
      setMessage("Choose at least one mood and mark one of them as primary.");
      return;
    }
    const db = getSupabaseBrowserClient();
    const current = data.destCategories.map((c) => c.category_id);
    const removed = current.filter((c) => !selected.includes(c));
    // Clear the old primary first (one primary per destination is enforced by a unique index).
    const steps = [
      removed.length ? db.from("destination_categories").delete().eq("destination_id", destId).in("category_id", removed) : null,
      db.from("destination_categories").update({ is_primary: false }).eq("destination_id", destId).neq("category_id", primary),
    ];
    for (const s of steps) {
      if (!s) continue;
      const { error } = await s;
      if (error) return setMessage(error.code === "42501" ? "Only admins can remove moods." : `Couldn't save: ${error.message}`);
    }
    const { error } = await db
      .from("destination_categories")
      .upsert(selected.map((c) => ({ destination_id: destId, category_id: c, is_primary: c === primary })));
    if (error) return setMessage(`Couldn't save: ${error.message}`);
    setMessage("Moods saved.");
    router.refresh();
  }

  return (
    <section aria-labelledby="cat-h" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 id="cat-h" className="text-xl font-bold">Moods (categories)</h2>
      <table className="w-full max-w-md border-collapse text-[15px]">
        <caption className="sr-only">Moods and primary mood</caption>
        <thead><tr className="text-left text-sm text-muted"><th scope="col" className="py-1 font-semibold">Mood</th><th scope="col" className="py-1 font-semibold">Included</th><th scope="col" className="py-1 font-semibold">Primary</th></tr></thead>
        <tbody>
          {data.categories.map((c) => (
            <tr key={c.id}>
              <th scope="row" className="py-1 text-left font-normal">{c.name}</th>
              <td><input type="checkbox" aria-label={`Include ${c.name}`} className="h-5 w-5" checked={selected.includes(c.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))} /></td>
              <td><input type="radio" name="primary-mood" aria-label={`${c.name} is primary`} className="h-5 w-5" checked={primary === c.id} onChange={() => { setPrimary(c.id); if (!selected.includes(c.id)) setSelected([...selected, c.id]); }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} className={`${buttonVariants.outline} h-10 px-4 text-sm`}>Save moods</button>
        <p role="status" className="text-sm text-muted">{message}</p>
      </div>
    </section>
  );
}

function SourcesPanel() {
  const router = useRouter();
  const [v, setV] = useState({ source_name: "", source_type: "official", source_url: "", publisher: "" });
  const [message, setMessage] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (v.source_name.trim().length < 2) return setMessage("Give the source a name.");
    if (v.source_url && !/^https:\/\/\S+$/.test(v.source_url.trim())) return setMessage("The URL must start with https://.");
    const { error } = await getSupabaseBrowserClient().from("information_sources").insert({
      source_name: v.source_name.trim(),
      source_type: v.source_type as "official" | "operator" | "field_visit" | "secondary",
      source_url: emptyOr(v.source_url),
      publisher: emptyOr(v.publisher),
      accessed_at: new Date().toISOString(),
    });
    if (error) return setMessage(`Couldn't add: ${error.message}`);
    setV({ source_name: "", source_type: "official", source_url: "", publisher: "" });
    setMessage("Source added. It's now in the Source lists below.");
    router.refresh();
  }

  return (
    <form onSubmit={add} noValidate className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xl font-bold">Add a source</h2>
      <p className="text-sm text-muted">Sources are shared across destinations. Cite them on costs, access records and attractions.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 sm:col-span-2"><label htmlFor="s-name" className={labelClass}>Name</label><input id="s-name" value={v.source_name} onChange={(e) => setV({ ...v, source_name: e.target.value })} className={inputClass} /></div>
        <div className="flex flex-col gap-1"><label htmlFor="s-type" className={labelClass}>Type</label><select id="s-type" value={v.source_type} onChange={(e) => setV({ ...v, source_type: e.target.value })} className={inputClass}>{["official", "operator", "field_visit", "secondary"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</select></div>
        <div className="flex flex-col gap-1"><label htmlFor="s-pub" className={labelClass}>Publisher <span className="font-normal text-muted">(optional)</span></label><input id="s-pub" value={v.publisher} onChange={(e) => setV({ ...v, publisher: e.target.value })} className={inputClass} /></div>
        <div className="flex flex-col gap-1 sm:col-span-4"><label htmlFor="s-url" className={labelClass}>URL <span className="font-normal text-muted">(optional)</span></label><input id="s-url" type="url" value={v.source_url} onChange={(e) => setV({ ...v, source_url: e.target.value })} className={inputClass} /></div>
      </div>
      <div className="flex items-center gap-3"><button type="submit" className={`${buttonVariants.outline} h-10 px-4 text-sm`}>Add source</button><p role="status" className="text-sm text-muted">{message}</p></div>
    </form>
  );
}

function StatusPanel({ data }: { data: EditorData }) {
  const router = useRouter();
  const d = data.destination!;
  const [failures, setFailures] = useState<{ code: string; message: string }[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const db = getSupabaseBrowserClient();

  async function revalidate() {
    await fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: d.slug }) }).catch(() => null);
  }

  async function setStatus(status: "draft" | "review" | "archived") {
    setBusy(true);
    const { error } = await db.from("destinations").update({ publication_status: status }).eq("id", d.id);
    setBusy(false);
    if (error) return setMessage(error.code === "42501" ? "Only admins can do that." : `Couldn't change status: ${error.message}`);
    if (status === "archived" || d.publication_status === "published") await revalidate();
    setMessage(`Status changed to ${status}.`);
    router.refresh();
  }

  async function publish() {
    setBusy(true);
    setFailures([]);
    const { data: result, error } = await db.rpc("publish_destination", { destination_id: d.id });
    setBusy(false);
    if (error) return setMessage(error.code === "42501" ? "Only admins can publish." : `Couldn't publish: ${error.message}`);
    const r = result as { published: boolean; failures: { code: string; message: string }[] };
    if (!r.published) {
      setFailures(r.failures);
      setMessage("Not published yet. Fix the items below.");
      return;
    }
    await revalidate();
    setMessage("Published. The public page updates on its next visit.");
    router.refresh();
  }

  return (
    <section aria-labelledby="status-h" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 id="status-h" className="text-xl font-bold">Status: {d.publication_status}</h2>
      <div className="flex flex-wrap gap-2.5">
        <Link href={`/admin/destinations/${d.id}/preview`} className={`${buttonVariants.outline} h-10 px-4 text-sm`}>Preview</Link>
        {d.publication_status === "draft" ? <button type="button" disabled={busy} onClick={() => setStatus("review")} className={`${buttonVariants.outline} h-10 px-4 text-sm`}>Submit for review</button> : null}
        {data.isAdmin && d.publication_status !== "published" ? <button type="button" disabled={busy} onClick={publish} className={`${buttonVariants.primary} h-10 px-4 text-sm`}>Publish</button> : null}
        {data.isAdmin && d.publication_status !== "archived" ? <button type="button" disabled={busy} onClick={() => { if (window.confirm("Archive this destination? It will stop being shown or recommended.")) setStatus("archived"); }} className="min-h-10 px-2 text-sm font-semibold text-error-inline">Archive</button> : null}
        {data.isAdmin && d.publication_status === "archived" ? <button type="button" disabled={busy} onClick={() => setStatus("draft")} className={`${buttonVariants.outline} h-10 px-4 text-sm`}>Restore to draft</button> : null}
      </div>
      {!data.isAdmin ? <p className="text-sm text-muted">Editors prepare and submit for review; an admin publishes.</p> : null}
      {failures.length ? (
        <ul role="alert" className="list-disc rounded-xl border border-warn-border bg-warn-bg py-3 pl-8 pr-3 text-[15px] text-warn-text">
          {failures.map((f) => <li key={f.code}>{f.message}</li>)}
        </ul>
      ) : null}
      <p role="status" className="text-sm text-muted">{message}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------

const money = (r: Row) =>
  r.amount_minor != null ? formatInr(Number(r.amount_minor)) : r.minimum_amount_minor != null ? `${formatInr(Number(r.minimum_amount_minor))}–${formatInr(Number(r.maximum_amount_minor))}` : "—";
const dateOf = (v: unknown) => (v ? formatDate(String(v)) : "—");
const pastDue = (v: unknown) => Boolean(v) && new Date(String(v)).getTime() < new Date().setHours(0, 0, 0, 0);

export function DestinationEditor({ data }: { data: EditorData }) {
  const destId = data.destination!.id;
  const src = data.sources;
  const attractionOptions = data.attractions.map((a) => ({ value: String(a.id), label: String(a.name) }));
  const verification = (required: boolean) => [
    { name: "source_id", label: "Source", kind: "select" as const, options: src, required },
    { name: "verified_at", label: "Verified on", kind: "timestamp" as const, required },
    { name: "review_due_at", label: "Review due", kind: "timestamp" as const, required },
  ];
  const dueAfterVerified = (v: Record<string, unknown>): Record<string, string> =>
    v.verified_at && v.review_due_at && String(v.review_due_at) <= String(v.verified_at) ? { review_due_at: "Review due must be after the verified date." } : {};

  const configs: TableConfig[] = [
    {
      table: "attractions",
      title: "Attractions",
      singular: "Attraction",
      fields: [
        { name: "name", label: "Name", kind: "text", required: true },
        { name: "description", label: "Description", kind: "textarea" },
        { name: "activity_duration_minutes", label: "Time needed (minutes)", kind: "number", min: 5, max: 600 },
        { name: "priority", label: "Priority", kind: "select", required: true, options: [{ value: "1", label: "1 · Must see" }, { value: "2", label: "2 · Normal" }, { value: "3", label: "3 · Optional" }] },
        { name: "entry_fee_minor", label: "Entry fee (₹ per person)", kind: "money", hint: "Leave empty if unknown; 0 if free." },
        { name: "latitude", label: "Latitude", kind: "number", min: 8, max: 13 },
        { name: "longitude", label: "Longitude", kind: "number", min: 74, max: 78 },
        { name: "is_active", label: "Active", kind: "checkbox" },
        { name: "source_id", label: "Source", kind: "select", options: src },
        { name: "verified_at", label: "Verified on", kind: "timestamp" },
        { name: "review_due_at", label: "Review due", kind: "timestamp" },
      ],
      defaults: { priority: "2", is_active: true },
      summary: (r) => `${r.name}${r.is_active ? "" : " (inactive)"}`,
      detail: (r) => `Priority ${r.priority} · ${r.activity_duration_minutes ?? "?"} min · entry ${r.entry_fee_minor == null ? "unknown" : formatInr(Number(r.entry_fee_minor))}`,
      validate: dueAfterVerified,
    },
    {
      table: "destination_costs",
      title: "Costs",
      singular: "Cost",
      fields: [
        { name: "cost_type", label: "Type", kind: "select", required: true, options: ["food", "parking", "toll", "accommodation", "public_transport", "guide", "other"].map((t) => ({ value: t, label: t.replace("_", " ") })) },
        { name: "label", label: "Label (shown on the breakdown)", kind: "text", required: true },
        { name: "unit", label: "Unit", kind: "select", required: true, options: [{ value: "per_person", label: "Per person" }, { value: "per_vehicle", label: "Per vehicle" }, { value: "per_group", label: "Per group" }, { value: "per_room_night", label: "Per room per night" }] },
        { name: "transport_mode", label: "Only for transport mode", kind: "select", options: MODES },
        { name: "amount_minor", label: "Amount (₹)", kind: "money", hint: "Either an amount, or both a minimum and a maximum." },
        { name: "minimum_amount_minor", label: "Minimum (₹)", kind: "money" },
        { name: "maximum_amount_minor", label: "Maximum (₹)", kind: "money" },
        { name: "valid_from", label: "Valid from", kind: "date" },
        { name: "valid_until", label: "Valid until", kind: "date" },
        { name: "is_essential", label: "Essential (missing ⇒ not recommended)", kind: "checkbox" },
        { name: "assumptions", label: "Assumptions", kind: "textarea" },
        ...verification(false),
      ],
      summary: (r) => `${r.label}: ${money(r)}`,
      detail: (r) => `${String(r.unit).replace(/_/g, " ")}${r.transport_mode ? ` · ${r.transport_mode}` : ""}${r.is_essential ? " · essential" : ""} · verified ${dateOf(r.verified_at)}${pastDue(r.review_due_at) ? " · REVIEW DUE" : ""}`,
      validate: (v) => {
        const e: Record<string, string> = { ...dueAfterVerified(v) };
        const has = (k: string) => String(v[k] ?? "").trim() !== "";
        if (!has("amount_minor") && !(has("minimum_amount_minor") && has("maximum_amount_minor"))) e.amount_minor = "Enter an amount, or both a minimum and a maximum.";
        if (has("minimum_amount_minor") && has("maximum_amount_minor") && Number(v.minimum_amount_minor) > Number(v.maximum_amount_minor)) e.maximum_amount_minor = "Maximum must be at least the minimum.";
        if (has("valid_from") && has("valid_until") && String(v.valid_from) > String(v.valid_until)) e.valid_until = "Must be on or after Valid from.";
        return e;
      },
    },
    {
      table: "access_information",
      title: "Access, permits & safety",
      singular: "Access record",
      fields: [
        { name: "restriction_type", label: "Type", kind: "select", required: true, options: ["general", "seasonal", "permit", "entry", "safety", "road", "transport", "weather"].map((t) => ({ value: t, label: t })) },
        { name: "status", label: "Status", kind: "select", required: true, options: ["open", "restricted", "closed", "advisory", "unknown"].map((t) => ({ value: t, label: t })) },
        { name: "is_essential", label: "Essential (decides whether visitors can get in)", kind: "checkbox" },
        { name: "attraction_id", label: "Applies to one attraction", kind: "select", options: attractionOptions },
        { name: "details", label: "Public details", kind: "textarea", required: true },
        { name: "valid_from", label: "Valid from", kind: "date" },
        { name: "valid_until", label: "Valid until", kind: "date" },
        { name: "excluded_transport_modes", label: "Excluded transport modes", kind: "multiselect", options: MODES },
        ...verification(true),
      ],
      defaults: { status: "open", is_essential: true },
      summary: (r) => `${r.restriction_type} · ${r.status}${r.is_essential ? " · essential" : ""}${r.attraction_id ? " · one attraction" : ""}`,
      detail: (r) => `Verified ${dateOf(r.verified_at)} · review due ${dateOf(r.review_due_at)}${pastDue(r.review_due_at) ? " · ACCESS CHECK DUE" : ""}`,
      validate: (v) => ({
        ...dueAfterVerified(v),
        ...(v.valid_from && v.valid_until && String(v.valid_from) > String(v.valid_until) ? { valid_until: "Must be on or after Valid from." } : {}),
      }),
    },
    {
      table: "destination_images",
      title: "Images",
      singular: "Image",
      fields: [
        { name: "external_url", label: "Image URL", kind: "url", hint: "Approved hosts only. Or use a Storage path." },
        { name: "storage_path", label: "Storage path", kind: "text" },
        { name: "alt_text", label: "Alt text", kind: "text", required: true, hint: "Describe the photo. Empty only for decorative images." },
        { name: "caption", label: "Caption", kind: "text" },
        { name: "credit", label: "Credit", kind: "text", required: true },
        { name: "licence", label: "Licence", kind: "text", required: true },
        { name: "sort_order", label: "Order", kind: "number", min: 0, max: 100 },
        { name: "is_primary", label: "Primary image", kind: "checkbox" },
      ],
      defaults: { sort_order: "0" },
      summary: (r) => `${r.alt_text || "(decorative)"}${r.is_primary ? " · primary" : ""}`,
      detail: (r) => `${r.credit} · ${r.licence}`,
      validate: (v): Record<string, string> =>
        !String(v.external_url ?? "").trim() === !String(v.storage_path ?? "").trim() ? { external_url: "Give either an image URL or a Storage path (not both)." } : {},
    },
    {
      table: "location_destination_routes",
      title: "Routes from starting towns",
      singular: "Route",
      keys: ["location_id", "destination_id", "transport_mode"],
      adminOnly: true,
      fields: [
        { name: "location_id", label: "Starting town", kind: "select", required: true, options: data.locations },
        { name: "transport_mode", label: "Mode", kind: "select", required: true, options: MODES },
        { name: "distance_km", label: "Distance one way (km)", kind: "number", required: true, min: 1, max: 1000 },
        { name: "duration_minutes", label: "Time one way (minutes)", kind: "number", required: true, min: 5, max: 1440 },
        { name: "provider", label: "Provider", kind: "text", required: true, hint: "e.g. manual, or the routing service" },
        { name: "computed_at", label: "Measured on", kind: "timestamp", required: true },
      ],
      defaults: { provider: "manual" },
      summary: (r) => `${data.locations.find((l) => l.value === r.location_id)?.label ?? "?"} · ${r.transport_mode}`,
      detail: (r) => `${r.distance_km} km · ${r.duration_minutes} min · ${r.provider}`,
    },
  ];
  const rowsFor: Record<string, Row[]> = {
    attractions: data.attractions,
    destination_costs: data.costs,
    access_information: data.access,
    destination_images: data.images,
    location_destination_routes: data.routes,
  };

  return (
    <div className="flex flex-col gap-5">
      <StatusPanel data={data} />
      <DetailsForm data={data} />
      <CategoryEditor data={data} />
      <SourcesPanel />
      {configs.map((c) => (
        <RecordTable key={c.table} config={c} rows={rowsFor[c.table]} parent={{ column: "destination_id", id: destId }} isAdmin={data.isAdmin} />
      ))}
    </div>
  );
}
