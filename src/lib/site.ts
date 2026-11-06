/** Public contact address (NEXT_PUBLIC_CONTACT_EMAIL). null until the operator sets one. */
export const contactEmail: string | null = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
