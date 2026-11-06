export type NavLink = { href: string; label: string };

/** Primary navigation (UI/UX spec §2). */
export const primaryNav: NavLink[] = [
  { href: "/explore", label: "Explore Kerala" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/saved", label: "Saved trips" },
  { href: "/about", label: "About" },
];

/** Footer navigation: primary plus utility links. */
export const footerNav: NavLink[] = [
  ...primaryNav,
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];
