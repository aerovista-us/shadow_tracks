/* Shadow Album Player — Service Worker (offline-first app shell) */
const CACHE_VERSION = "shadowplayer-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./audio/sample.wav"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(APP_SHELL);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k === CACHE_VERSION ? null : caches.delete(k))));
      self.clients.claim();
    })()
  );
});

// Cache strategy:
// - App shell: cache-first
// - Audio: try cache, then network, then cache it (best-effort)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  const isAudio = url.pathname.includes("/audio/") || req.destination === "audio";

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);

    // Cache-first for app shell and most assets
    const cached = await cache.match(req);
    if (cached && !isAudio) return cached;

    try {
      const res = await fetch(req);
      // Best-effort cache
      if (res && res.ok) {
        // Audio can be large; browsers may evict it. Still worth a try.
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (err) {
      // Offline fallback
      if (cached) return cached;
      // Last resort: for navigation, serve cached shell
      if (req.mode === "navigate") {
        const shell = await cache.match("./index.html");
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
