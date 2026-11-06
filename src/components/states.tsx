import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/button-link";

/** ErrorState (BUILD_BRIEF §5): text, not colour alone; a way forward. */
export function ErrorState({
  title,
  children,
  action,
  reference,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  reference?: string;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-error-border bg-error-bg p-5 text-error-text">
      <h1 className="text-[26px] font-bold leading-tight">{title}</h1>
      <div className="text-[15px] leading-normal">{children}</div>
      {action ? <div className="flex flex-wrap gap-2.5">{action}</div> : null}
      {reference ? <p className="text-sm">Reference: {reference}</p> : null}
    </div>
  );
}

/** EmptyState (BUILD_BRIEF §5). */
export function EmptyState({ title, children, href, cta }: { title: string; children: ReactNode; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-[15px] leading-normal text-muted">{children}</p>
      <Link href={href} className={buttonVariants.primary}>
        {cta}
      </Link>
    </div>
  );
}
