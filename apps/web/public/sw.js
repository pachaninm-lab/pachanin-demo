// GrainFlow PWA Service Worker — офлайн-поддержка для водителей и агентов
const CACHE_VERSION = 'v8-grainflow-1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DEAL_CACHE = `${CACHE_VERSION}-deal`;
const API_CACHE = `${CACHE_VERSION}-api`;

const DRIVER_SCOPE_PREFIX = '/platform-v7/driver';

// Статические ресурсы для предзагрузки
const SHELL_ASSETS = [
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/manifest.json',
];

// ──────────────────────────────────────────────────────────────────────────────
// Install — предзаполняем кеш оболочки
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch(() => {})
    )
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Activate — удаляем старые кеши
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.startsWith(CACHE_VERSION))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ──────────────────────────────────────────────────────────────────────────────
// Fetch — стратегии кеширования
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isGetRequest = event.request.method === 'GET';
  const isDriverRoute = url.pathname.startsWith(DRIVER_SCOPE_PREFIX);
  const isNavigate = event.request.mode === 'navigate';
  const isApiCall = url.pathname.startsWith('/api/');

  if (!isGetRequest) return;

  // CacheFirst — страницы водителя (офлайн критично)
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

  // StaleWhileRevalidate — API вызовы из маршрута водителя
  if (isDriverRoute && isApiCall) {
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
    return;
  }

  // NetworkFirst — остальные API (свежесть важнее)
  if (isApiCall) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            caches.open(API_CACHE).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // NetworkFirst — навигация
  if (isNavigate) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request) ?? caches.match('/platform-v7/driver')
      )
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Background Sync — синхронизация офлайн-действий при восстановлении сети
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-actions-sync') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  const db = await openDB();
  const tx = db.transaction('offline_actions', 'readwrite');
  const store = tx.objectStore('offline_actions');
  const actions = await store.getAll();

  for (const action of actions) {
    try {
      const resp = await fetch(action.url, {
        method: action.method,
        headers: { 'Content-Type': 'application/json', ...action.headers },
        body: action.body,
      });
      if (resp.ok) {
        await store.delete(action.id);
      }
    } catch {
      // Будет повторено при следующей синхронизации
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('grainflow-offline', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offline_actions')) {
        db.createObjectStore('offline_actions', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Push-уведомления
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'GrainFlow', {
      body: data.body || '',
      icon: '/icon',
      badge: '/icon',
      tag: data.tag || 'grainflow',
      data: data.url ? { url: data.url } : undefined,
      actions: data.actions || [],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/platform-v7';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes('/platform-v7'));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Сообщения от приложения
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'OFFLINE_ACTION') {
    event.ports?.[0]?.postMessage({ queued: true });
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_DEAL') {
    const { url, data } = event.data;
    caches.open(DEAL_CACHE).then((cache) => {
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
      cache.put(url, response);
    });
  }
});
