import Link from "next/link";
import { footerNav } from "@/lib/navigation";

export function AppFooter() {
  return (
    <footer className="mt-12 bg-footer text-[15px] text-footer-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-[18px] px-4 py-7">
        <span className="font-display text-lg font-bold text-white">
          Trip Roulette Kerala
        </span>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {footerNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-footer-text hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-[13px] leading-normal text-footer-muted">
          Trip Roulette plans trips; it doesn&apos;t make bookings. Check the
          official source before travelling.
        </p>
      </div>
    </footer>
  );
}
