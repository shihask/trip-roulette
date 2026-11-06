import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "spin" | "outline";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold no-underline transition-colors";

export const buttonVariants: Record<Variant, string> = {
  primary: `${base} h-[54px] bg-green px-6 text-[17px] text-white hover:bg-green-ink hover:text-white`,
  spin: `${base} h-14 bg-warm px-6 text-[17px] text-white hover:bg-warm-ink hover:text-white`,
  outline: `${base} h-[52px] border-[1.5px] border-line-strong bg-surface px-6 text-base text-ink hover:border-ink hover:text-ink`,
};

/** PrimaryButton rendered as a link (BUILD_BRIEF §5: primary, spin, outline). */
export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={`${buttonVariants[variant]} ${className}`} />;
}

export function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4 9h10M10 5l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
