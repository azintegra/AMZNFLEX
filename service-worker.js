const CACHE_NAME = 'gatecodes-v6'; // bump when you change static files!

const STATIC_FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Only set this if you actually create offline.html
const FALLBACK_HTML = null;

// Install → precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// Activate → clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    })()
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always network for dynamic files (no caching)
  if (url.pathname.endsWith('/app.js') || url.pathname.endsWith('/data.json')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('Offline – data not available', { status: 503 }))
    );
    return;
  }

  // Stale-While-Revalidate for static assets
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cached = await cache.match(event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          if (cached) return cached;
          if (FALLBACK_HTML) return caches.match(FALLBACK_HTML);
          return new Response('', { status: 504 });
        });

      return cached || fetchPromise;
    })()
  );
});
