const RECOVERY_WORKER = String.raw`// Platform v7 recovery worker: never cache pages or app chunks.
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
`;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return new Response(RECOVERY_WORKER, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': 'no-store',
      'Service-Worker-Allowed': '/',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
