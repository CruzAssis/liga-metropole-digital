// Liga Metrópole Digital — Service Worker
// App Shell Cache Strategy

const CACHE_NAME = 'liga-metropole-v1';
const STATIC_CACHE = 'liga-metropole-static-v1';
const API_CACHE = 'liga-metropole-api-v1';

// App shell assets to cache on install
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ─── Install: cache app shell ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Liga Metrópole Service Worker');
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Liga Metrópole Service Worker');
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) =>
                name !== STATIC_CACHE &&
                name !== API_CACHE &&
                name !== CACHE_NAME
            )
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: Network-first for API, Cache-first for shell ─────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (e.g., Supabase API calls)
  if (url.origin !== self.location.origin) return;

  // Skip Supabase/API paths — always network
  if (
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/') ||
    url.pathname.startsWith('/storage/')
  ) {
    return;
  }

  // For navigation requests (HTML) — Network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() =>
          caches.match('/').then(
            (cached) =>
              cached ||
              new Response(
                '<html><body><h1>Liga Metrópole</h1><p>Sem conexão. Tente novamente.</p></body></html>',
                {
                  headers: { 'Content-Type': 'text/html' },
                }
              )
          )
        )
    );
    return;
  }

  // For static assets — Cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || !response.ok) return response;

        // Cache static assets (JS, CSS, images, fonts)
        if (
          url.pathname.match(/\.(?:js|css|png|svg|ico|woff2?|ttf|eot)$/)
        ) {
          const responseClone = response.clone();
          caches
            .open(STATIC_CACHE)
            .then((cache) => cache.put(request, responseClone));
        }

        return response;
      });
    })
  );
});

// ─── Push notifications stub (for future use) ────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nova notificação da Liga Metrópole',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Liga Metrópole', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
