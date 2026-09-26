/*
 * Minimal offline/install service worker for Arthouse.
 *
 * The app does its own image processing entirely in the browser with no
 * backend, so there is nothing dynamic to be clever about here — this just
 * needs to (a) make the app installable, and (b) let a repeat visit open
 * instantly and keep working offline. No build-time asset manifest is
 * required: hashed Next.js chunk URLs are cached the first time they're
 * requested (cache-first, since a hashed URL never changes its content),
 * and the page itself is network-first with a cached fallback.
 *
 * Bump VERSION when this file's *strategy* changes; ordinary app releases
 * don't need a bump — hashed asset URLs change on their own, and the "/"
 * document is always re-fetched from the network when online.
 */
const VERSION = "v1";
const CACHE = `arthouse-${VERSION}`;
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SHELL_URL, "/manifest.webmanifest"]))
      .catch(() => {
        /* offline install (e.g. first load already failed) — fine, skip precache */
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept the dev server's hot-reload machinery.
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // Page navigations: prefer the network (so visitors get the latest build),
  // fall back to whatever was cached, and finally the app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match(SHELL_URL)) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Hashed build assets and app icons never change under a given URL, so
  // cache-first is safe and makes repeat loads instant.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Everything else (fonts, misc assets): stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((fresh) => {
          cache.put(request, fresh.clone());
          return fresh;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
