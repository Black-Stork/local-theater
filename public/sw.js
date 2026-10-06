/* Local Bay — minimal SW for installability. No offline API caching. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Always go to network — torrent/media APIs must not be cached.
  event.respondWith(fetch(event.request));
});
