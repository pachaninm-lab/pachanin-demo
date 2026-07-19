// Platform v7 recovery worker: never cache pages or app chunks.
// Older pilot workers could retain a stale public entry document. This worker
// takes control once, clears legacy storage, moves affected entry clients to a
// cache-busted URL, and unregisters itself so the recovery cannot loop.
const RECOVERY_VERSION = '2026-07-19-contact-dock-v3';
const RECOVERY_PARAMETER = 'pc-sw-recovery';
const ENTRY_PATHS = new Set(['/', '/platform-v7', '/pc-public-entry/platform-v7']);

async function clearLegacyCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(clearLegacyCaches());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await clearLegacyCaches();
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await self.registration.unregister();

    await Promise.all(clients.map(async (client) => {
      try {
        const url = new URL(client.url);
        const normalizedPath = url.pathname.replace(/\/+$/u, '') || '/';
        if (url.origin !== self.location.origin || !ENTRY_PATHS.has(normalizedPath)) return;
        if (url.searchParams.get(RECOVERY_PARAMETER) === RECOVERY_VERSION) return;
        url.searchParams.set(RECOVERY_PARAMETER, RECOVERY_VERSION);
        await client.navigate(url.toString());
      } catch {
        // A closed or non-navigable client requires no recovery action.
      }
    }));
  })());
});

self.addEventListener('fetch', () => {
  return;
});
