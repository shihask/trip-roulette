import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { getAdminContext } from "@/lib/admin";

/**
 * POST /api/revalidate — refreshes cached public destination data after publish/archive (ARCHITECTURE §12).
 * Allowed with the REVALIDATE_SECRET header (automation) or a signed-in editor/admin session (the admin UI).
 * Body: { "slug"?: string }. Revalidates the destination list and, if given, that destination.
 */
function secretMatches(given: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const allowed = secretMatches(request.headers.get("x-revalidate-secret")) || (await getAdminContext()) !== null;
  if (!allowed) return Response.json({ error: { code: "FORBIDDEN", message: "Not allowed." } }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" && /^[a-z0-9-]{1,80}$/.test(body.slug) ? body.slug : null;

  // Archive must take effect immediately, so stale content is never served after this call.
  revalidateTag("destinations", { expire: 0 });
  if (slug) revalidateTag(`destination:${slug}`, { expire: 0 });
  return Response.json({ revalidated: ["destinations", ...(slug ? [`destination:${slug}`] : [])] });
}
