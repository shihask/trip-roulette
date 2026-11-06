/*
 * Trip Roulette Kerala service worker (ARCHITECTURE §12).
 * Caches: versioned static assets, public destination pages and images, the saved-trips page and
 * the last-viewed trips, so they open offline. Never caches: admin pages, API or auth calls,
 * shared-trip links, or anything cross-origin (Supabase). Spinning needs a connection.
 */
const VERSION = "tr-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/saved", "/", "/manifest.webmanifest", "/icons/icon-192.png"];
const MAX_TRIP_PAGES = 10;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Pages that may be kept for offline reading. */
function cacheablePage(path) {
  return (
    path === "/" ||
    path === "/saved" ||
    path === "/plan" ||
    path === "/explore" ||
    path === OFFLINE_URL ||
    path.startsWith("/destinations/") ||
    path.startsWith("/trip/")
  );
}

function neverCache(path) {
  return path.startsWith("/admin") || path.startsWith("/api/") || path.startsWith("/shared/");
}

async function trimTripPages(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith("/trip/"));
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_TRIP_PAGES))) await cache.delete(old);
}

async function networkFirstPage(request, path) {
  try {
    const response = await fetch(request);
    if (response.ok && cacheablePage(path)) {
      const cache = await caches.open(PAGES);
      await cache.delete(request, { ignoreSearch: true });
      await cache.put(request, response.clone());
      if (path.startsWith("/trip/")) await trimTripPages(cache);
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase and other origins: network only
  const path = url.pathname;
  if (neverCache(path)) return;

  // Next.js client-navigation payloads (RSC): network only; a failed fetch falls back to a full page load.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, path));
    return;
  }
  if (path.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (path.startsWith("/icons/") || /\.(png|jpe?g|webp|avif|svg|woff2?)$/.test(path)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
