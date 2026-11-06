import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Cloudflare Turnstile (CAPTCHA on sign-in, src/lib/turnstile.ts): its script and challenge iframe.
const turnstileOrigin = "https://challenges.cloudflare.com";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";

/**
 * Site-wide CSP without nonces: nonces need every page rendered per request, which would turn off
 * the cached/prerendered public pages (Next.js CSP guide, "Static vs Dynamic Rendering with CSP").
 * So inline scripts stay allowed (Next.js streams its payload in inline scripts), but scripts can
 * only come from this site, the browser may only talk to this site and Supabase, nothing may frame
 * the site, and plugins, <base> and cross-site form posts are off. 'unsafe-eval' is dev-only (React
 * debugging). Add a host here before loading anything new from another site (a CAPTCHA widget, a
 * map, images from a CDN).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstileOrigin}${isDev ? " 'unsafe-eval'" : ""}`,
  `frame-src ${turnstileOrigin}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Browsers ignore this over plain http (localhost); on the real domain it pins HTTPS for two years.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    // Later rules override earlier ones for the same header key, so the general rule comes first.
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        // Shared trips carry a secret token in the URL (ARCHITECTURE §11.4).
        source: "/shared/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
