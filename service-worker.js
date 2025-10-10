// ===============================
// 🚀 TripA-B Service Worker (v16 Auto-Update)
// ===============================

const CACHE_VERSION = 'v16';
const CACHE_NAME = `trip-ab-cache-${CACHE_VERSION}`;
const urlsToCache = [
  './index.html',
  './TripA-B.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 📦 INSTALL
self.addEventListener('install', event => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // ⏩ เข้าทำงานทันที
});

// ♻️ ACTIVATE
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)));
      await self.clients.claim();

      // แจ้งทุก client ให้แสดง popup แล้ว reload
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ action: 'showUpdatePopup' });
      }
    })()
  );
});

// 🌐 FETCH
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request).then(networkResp => {
        if (!networkResp || networkResp.status !== 200) return networkResp;
        const respClone = networkResp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        return networkResp;
      });
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