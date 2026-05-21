// Service worker — Driver offline support (§C-4)
const CACHE_VERSION = 'v7-driver-1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DEAL_CACHE = `${CACHE_VERSION}-deal`;

const DRIVER_SHELL_ASSETS = [
  '/platform-v7/driver',
  '/platform-v7/driver/field',
];

const DRIVER_SCOPE_PREFIX = '/platform-v7/driver';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(DRIVER_SHELL_ASSETS).catch(() => {})
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('v7-driver-') && k !== SHELL_CACHE && k !== DEAL_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isDriverRoute = url.pathname.startsWith(DRIVER_SCOPE_PREFIX);
  const isNavigate = event.request.mode === 'navigate';
  const isGetRequest = event.request.method === 'GET';

  if (!isGetRequest) return;

  // Shell: CacheFirst for driver routes
  if (isDriverRoute && isNavigate) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => caches.match('/platform-v7/driver') ?? Response.error());
      })
    );
    return;
  }

  // Deal snapshot: StaleWhileRevalidate for deal API calls from driver scope
  if (isDriverRoute && url.pathname.includes('/api/')) {
    event.respondWith(
      caches.open(DEAL_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkPromise = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => null);
        return cached ?? await networkPromise ?? Response.error();
      })
    );
  }
});

// Receive messages to queue offline actions
self.addEventListener('message', (event) => {
  if (event.data?.type === 'OFFLINE_ACTION') {
    // Stored in IndexedDB by the app; SW signals back when network returns
    event.ports?.[0]?.postMessage({ queued: true });
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
