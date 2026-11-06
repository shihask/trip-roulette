import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before trip and admin pages:
 * - refreshes the Supabase session cookie, so Server Components see a valid token (they can't write cookies);
 * - sends visitors without a permanent (non-anonymous) account from /admin to /admin/login.
 *   This is a convenience only: RLS is the real enforcement (ARCHITECTURE §11.3).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Validates the token and refreshes it if it has expired.
  const { data } = await supabase.auth.getClaims();

  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin") && path !== "/admin/login") {
    const claims = data?.claims;
    if (!claims?.sub || claims.is_anonymous === true) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      const redirect = NextResponse.redirect(url);
      for (const c of response.cookies.getAll()) redirect.cookies.set(c);
      return redirect;
    }
  }
  return response;
}

export const config = {
  matcher: ["/trip/:path*", "/admin/:path*"],
};
