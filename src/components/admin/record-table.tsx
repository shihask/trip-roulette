"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { buttonVariants } from "@/components/button-link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { inputClass, labelClass } from "./admin-ui";

/**
 * Generic editor for a destination's child records (attractions, costs, access, images, routes).
 * Writes go straight to Postgres under the editor's session, so RLS and the audit triggers apply.
 * After each write the page re-reads from the server (router.refresh), which stays the source of truth.
 */

export type Option = { value: string; label: string };
export type Field = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "url" | "number" | "money" | "select" | "checkbox" | "date" | "timestamp" | "multiselect";
  required?: boolean;
  options?: Option[];
  hint?: string;
  min?: number;
  max?: number;
};

export type Row = Record<string, unknown> & { id?: string };
type FormValues = Record<string, string | boolean | string[]>;

export type TableConfig = {
  table: string;
  title: string;
  singular: string;
  fields: Field[];
  /** Primary key columns used for update/delete (default ["id"]). */
  keys?: string[];
  summary: (row: Row) => string;
  detail?: (row: Row) => string;
  defaults?: FormValues;
  validate?: (v: FormValues) => Record<string, string>;
  /** Only admins can write (e.g. routes). */
  adminOnly?: boolean;
};

const istDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

function fromDb(field: Field, value: unknown): string | boolean | string[] {
  if (field.kind === "checkbox") return Boolean(value);
  if (field.kind === "multiselect") return Array.isArray(value) ? (value as string[]) : [];
  if (value === null || value === undefined) return "";
  if (field.kind === "money") return String(Number(value) / 100);
  if (field.kind === "timestamp") return istDate(String(value));
  return String(value);
}

function toDb(field: Field, value: string | boolean | string[]): unknown {
  if (field.kind === "checkbox" || field.kind === "multiselect") return value;
  const s = String(value).trim();
  if (s === "") return null;
  if (field.kind === "number") return Number(s);
  if (field.kind === "money") return Math.round(Number(s) * 100);
  if (field.kind === "timestamp") return `${s}T00:00:00+05:30`;
  return s;
}

function check(fields: Field[], v: FormValues): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of fields) {
    const val = v[f.name];
    const s = typeof val === "string" ? val.trim() : "";
    if (f.required && f.kind !== "checkbox" && f.kind !== "multiselect" && s === "") e[f.name] = `${f.label} is required.`;
    else if ((f.kind === "number" || f.kind === "money") && s !== "") {
      const n = Number(s);
      if (!Number.isFinite(n)) e[f.name] = `${f.label} must be a number.`;
      else if (f.kind === "money" && (n < 0 || !Number.isInteger(n))) e[f.name] = `${f.label} must be whole rupees, 0 or more.`;
      else if (f.min !== undefined && n < f.min) e[f.name] = `${f.label} must be at least ${f.min}.`;
      else if (f.max !== undefined && n > f.max) e[f.name] = `${f.label} must be at most ${f.max}.`;
    } else if (f.kind === "url" && s !== "" && !/^https:\/\/\S+$/.test(s)) e[f.name] = `${f.label} must start with https://.`;
  }
  return e;
}

export function RecordTable({
  config,
  rows,
  parent,
  isAdmin,
}: {
  config: TableConfig;
  rows: Row[];
  parent: { column: string; id: string };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<{ key: Record<string, unknown> | null; values: FormValues } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const keys = config.keys ?? ["id"];
  const canWrite = !config.adminOnly || isAdmin;

  function startNew() {
    const values: FormValues = {};
    for (const f of config.fields) values[f.name] = config.defaults?.[f.name] ?? (f.kind === "checkbox" ? false : f.kind === "multiselect" ? [] : "");
    setEditing({ key: null, values });
    setErrors({});
    setMessage("");
  }

  function startEdit(row: Row) {
    const values: FormValues = {};
    for (const f of config.fields) values[f.name] = fromDb(f, row[f.name]);
    setEditing({ key: Object.fromEntries(keys.map((k) => [k, row[k]])), values });
    setErrors({});
    setMessage("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const errs = { ...check(config.fields, editing.values), ...(config.validate?.(editing.values) ?? {}) };
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = config.fields.find((f) => errs[f.name]);
      formRef.current?.querySelector<HTMLElement>(`[name="${first?.name}"]`)?.focus();
      return;
    }
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) payload[f.name] = toDb(f, editing.values[f.name]);
    setBusy(true);
    const db = getSupabaseBrowserClient();
    // The table name is configured per section; the generated types can't follow it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = db.from(config.table as any) as any;
    let query = editing.key ? table.update(payload) : table.insert({ ...payload, [parent.column]: parent.id });
    if (editing.key) for (const [k, v] of Object.entries(editing.key)) query = query.eq(k, v);
    const { error } = await query;
    setBusy(false);
    if (error) {
      setMessage(error.code === "42501" ? "You don't have permission to do that." : `Couldn't save: ${error.message}`);
      return;
    }
    setEditing(null);
    setMessage(`${config.singular} saved.`);
    router.refresh();
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}? This can't be undone.`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (getSupabaseBrowserClient().from(config.table as any) as any).delete();
    for (const k of keys) query = query.eq(k, row[k]);
    const { data, error } = await query.select();
    if (error) {
      setMessage(error.code === "23503" ? "It's still used elsewhere (for example by a trip), so it can't be deleted." : `Couldn't delete: ${error.message}`);
      return;
    }
    // RLS hides rows the caller may not delete, so nothing is deleted and no error is raised.
    setMessage(Array.isArray(data) && data.length === 0 ? "Only admins can delete." : `${config.singular} deleted.`);
    router.refresh();
  }

  const set = (name: string, value: string | boolean | string[]) => setEditing((ed) => (ed ? { ...ed, values: { ...ed.values, [name]: value } } : ed));

  return (
    <section aria-labelledby={`${formId}-h`} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${formId}-h`} className="text-xl font-bold">
          {config.title} <span className="text-base font-normal text-muted">({rows.length})</span>
        </h2>
        {canWrite && !editing ? (
          <button type="button" onClick={startNew} className={`${buttonVariants.outline} h-10 px-4 text-sm`}>
            Add {config.singular.toLowerCase()}
          </button>
        ) : null}
      </div>
      {config.adminOnly && !isAdmin ? <p className="text-sm text-muted">Only admins can change these.</p> : null}

      {rows.length ? (
        <ul className="flex flex-col divide-y divide-surface-muted">
          {rows.map((r, i) => (
            <li key={String(r.id ?? i)} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold">{config.summary(r)}</p>
                {config.detail ? <p className="text-sm text-muted">{config.detail(r)}</p> : null}
              </div>
              {canWrite ? (
                <div className="flex flex-none gap-3 text-sm font-semibold">
                  <button type="button" onClick={() => startEdit(r)} className="min-h-11 text-green">
                    Edit<span className="sr-only"> {config.summary(r)}</span>
                  </button>
                  <button type="button" onClick={() => remove(r)} className="min-h-11 text-error-inline">
                    Delete<span className="sr-only"> {config.summary(r)}</span>
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">None yet.</p>
      )}

      {editing ? (
        <form ref={formRef} onSubmit={save} noValidate className="flex flex-col gap-3 rounded-xl border border-line bg-ground p-3.5">
          <h3 className="font-body text-base font-semibold">{editing.key ? `Edit ${config.singular.toLowerCase()}` : `New ${config.singular.toLowerCase()}`}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map((f) => {
              const id = `${formId}-${f.name}`;
              const err = errors[f.name];
              const describedBy = [f.hint ? `${id}-hint` : null, err ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
              const val = editing.values[f.name];
              return (
                <div key={f.name} className={`flex flex-col gap-1 ${f.kind === "textarea" || f.kind === "multiselect" ? "sm:col-span-2" : ""}`}>
                  {f.kind === "checkbox" ? (
                    <label className="flex min-h-11 items-center gap-2 text-[15px]">
                      <input type="checkbox" name={f.name} checked={Boolean(val)} onChange={(e) => set(f.name, e.target.checked)} className="h-5 w-5" />
                      {f.label}
                    </label>
                  ) : f.kind === "multiselect" ? (
                    <fieldset aria-describedby={describedBy}>
                      <legend className={labelClass}>{f.label}</legend>
                      <div className="flex flex-wrap gap-x-4">
                        {f.options!.map((o) => (
                          <label key={o.value} className="flex min-h-11 items-center gap-2 text-[15px]">
                            <input
                              type="checkbox"
                              name={f.name}
                              checked={(val as string[]).includes(o.value)}
                              onChange={(e) =>
                                set(f.name, e.target.checked ? [...(val as string[]), o.value] : (val as string[]).filter((x) => x !== o.value))
                              }
                              className="h-5 w-5"
                            />
                            {o.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <>
                      <label htmlFor={id} className={labelClass}>
                        {f.label}
                        {f.required ? "" : <span className="font-normal text-muted"> (optional)</span>}
                      </label>
                      {f.kind === "textarea" ? (
                        <textarea id={id} name={f.name} rows={3} value={String(val)} onChange={(e) => set(f.name, e.target.value)} aria-invalid={Boolean(err)} aria-describedby={describedBy} className={`${inputClass} h-auto py-2`} />
                      ) : f.kind === "select" ? (
                        <select id={id} name={f.name} value={String(val)} onChange={(e) => set(f.name, e.target.value)} aria-invalid={Boolean(err)} aria-describedby={describedBy} className={inputClass}>
                          <option value="">{f.required ? "Choose…" : "None"}</option>
                          {f.options!.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={id}
                          name={f.name}
                          type={f.kind === "date" || f.kind === "timestamp" ? "date" : f.kind === "url" ? "url" : "text"}
                          inputMode={f.kind === "number" || f.kind === "money" ? "decimal" : undefined}
                          value={String(val)}
                          onChange={(e) => set(f.name, e.target.value)}
                          aria-invalid={Boolean(err)}
                          aria-describedby={describedBy}
                          className={inputClass}
                        />
                      )}
                    </>
                  )}
                  {f.hint ? (
                    <p id={`${id}-hint`} className="text-xs text-muted">
                      {f.hint}
                    </p>
                  ) : null}
                  {err ? (
                    <p id={`${id}-err`} className="text-sm font-medium text-error-inline">
                      {err}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2.5">
            <button type="submit" disabled={busy} className={`${buttonVariants.primary} h-11 text-[15px] disabled:opacity-70`}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className={`${buttonVariants.outline} h-11 text-[15px]`}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <p role="status" aria-live="polite" className="text-sm text-muted">
        {message}
      </p>
    </section>
  );
}
