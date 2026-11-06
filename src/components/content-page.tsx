import type { ReactNode } from "react";

/** Layout for the text pages (How it works, About, Contact, Privacy, Terms). */
export function ContentPage({
  title,
  lead,
  updated,
  notice,
  children,
}: {
  title: string;
  lead?: ReactNode;
  /** Shown as "Last updated …" (a plain date string, e.g. "6 November 2026"). */
  updated?: string;
  /** Highlighted notice above the content, e.g. that a policy is a draft. */
  notice?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
        {lead ? <p className="text-[17px] leading-normal text-muted">{lead}</p> : null}
        {updated ? <p className="text-sm text-muted">Last updated {updated}</p> : null}
      </header>
      {notice ? (
        <div role="note" className="rounded-2xl border-[1.5px] border-warm bg-warm-tint p-4 text-[15px] leading-normal">
          {notice}
        </div>
      ) : null}
      <div className="flex flex-col gap-8 text-[17px] leading-relaxed [&_a]:font-semibold [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}

export function ContentSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-[22px] font-bold leading-snug">
        {title}
      </h2>
      {children}
    </section>
  );
}
