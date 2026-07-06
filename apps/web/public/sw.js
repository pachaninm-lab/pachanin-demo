// Platform v7 pilot: do not cache pages or app chunks.
// Older mobile browsers may keep a previous service worker and serve stale Next
// chunks after deploy. This worker clears all caches, unregisters itself, and
// lets every request go to the network.
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
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (client.url && client.navigate) client.navigate(client.url);
    }
  })());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
