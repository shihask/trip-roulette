import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/admin/admin-ui";
import { getAdminContext } from "@/lib/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Trip Roulette Kerala" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4">
          <Link href="/admin" className="flex items-center gap-2 font-display text-[17px] font-bold text-ink no-underline">
            <BrandMark size={24} /> Admin
          </Link>
          <nav aria-label="Admin" className="flex gap-4 text-[15px] font-semibold">
            <Link href="/admin" className="text-ink">
              Destinations
            </Link>
            <Link href="/admin/audit" className="text-ink">
              Audit log
            </Link>
            <Link href="/" className="text-ink">
              View site
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <Suspense fallback={null}>
              <Who />
            </Suspense>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

async function Who() {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  return (
    <>
      <span className="hidden sm:inline">
        {ctx.email} · {ctx.role}
      </span>
      <SignOutButton />
    </>
  );
}
