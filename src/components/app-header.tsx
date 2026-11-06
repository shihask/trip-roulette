import Link from "next/link";
import { BrandMark, BrandName } from "@/components/brand-mark";
import { MobileMenu } from "@/components/mobile-menu";
import { primaryNav } from "@/lib/navigation";

export function AppHeader() {
  return (
    <header className="relative border-b border-line bg-ground">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 no-underline"
          aria-label="Trip Roulette Kerala, home"
        >
          <BrandMark />
          <BrandName />
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-6">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-[15px] font-semibold text-ink no-underline hover:text-green"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <MobileMenu links={primaryNav} />
      </div>
    </header>
  );
}
