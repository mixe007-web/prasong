// ===============================
// 🚀 TripA-B Service Worker (v18.1 Auto-Update + Smart Cache)
// ===============================

const CACHE_VERSION = 'v18.1';
const CACHE_NAME = `trip-ab-cache-${CACHE_VERSION}`;
const urlsToCache = [
  './TripA-B.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 📦 INSTALL
self.addEventListener('install', event => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(urlsToCache);

      // แจ้ง client เมื่อ SW ใหม่พร้อม (หลัง cache เสร็จ)
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
      }
    })()
  );
  self.skipWaiting();
});

// ♻️ ACTIVATE
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// 🌐 FETCH (stale-while-revalidate strategy)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // อย่า cache index.html → โหลดสดเสมอ
  if (url.pathname.endsWith('index.html')) {
    event.respondWith(fetch(event.request).catch(() => caches.match('./TripA-B.html')));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// 💬 MESSAGE
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] 🚀 Forcing activation of new SW...');
    self.skipWaiting();
  }
});
