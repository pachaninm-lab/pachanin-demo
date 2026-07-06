// Platform v7 pilot: do not cache pages or app chunks.
// This worker exists only to clear old CacheStorage once. It must not navigate
// clients on activation; otherwise mobile browsers can fall into a reload loop
// when the app registers /sw.js again on the next load.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    if (self.registration && self.registration.unregister) {
      await self.registration.unregister();
    }
  })());
});

self.addEventListener('fetch', () => {
  return;
});
