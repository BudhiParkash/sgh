/* Shivanshi Gaming Hub service worker — offline support for pages you've visited (incl. saved setups).
   Strategy: static assets cache-first; pages network-first with cached fallback; never caches /admin or the API's
   non-GET requests; falls back to /offline when nothing is cached. Bump VERSION to invalidate. */
const VERSION = "sgh-v3";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/icon.svg", "/icons/192", "/posters/hero.svg"];
const MAX_PAGES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/sw.js")) return;

  // Immutable build assets & media: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/posters/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/media/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Page navigations: network-first, cached copy when offline, else the offline page
  if (req.mode === "navigate") {
    // Always go to the network (bypassing the browser HTTP cache) so visitors never see stale
    // tournament/setup info while online; cached copies are only used offline.
    event.respondWith(
      // redirect: "manual" — the browser must follow redirects itself (a followed redirect can't answer a navigation).
      fetch(req.url, { cache: "no-store", credentials: "same-origin", redirect: "manual", headers: { Accept: "text/html" } })
        .then((res) => {
          if (res.ok && res.headers.get("content-type")?.includes("text/html")) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, MAX_PAGES));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/offline")) || Response.error()),
    );
  }
});
