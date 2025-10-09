// ===============================
// 🚀 TripA-B Service Worker (v15 Auto-Update + Popup Notice)
// ===============================

const CACHE_VERSION = 'v15';
const CACHE_NAME = `trip-ab-cache-${CACHE_VERSION}`;
const urlsToCache = [
  './index.html',
  './TripA-B.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// -------------------------------
// 📦 INSTALL
// -------------------------------
self.addEventListener('install', event => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of urlsToCache) {
      try {
        await cache.add(url);
        console.log(`[SW] ✅ Cached: ${url}`);
      } catch (err) {
        console.warn(`[SW] ⚠️ Skipped: ${url}`, err);
      }
    }
  })());
  self.skipWaiting();
});

// -------------------------------
// ♻️ ACTIVATE + AUTO REFRESH
// -------------------------------
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] 🧹 Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();

      // 🔄 แจ้งทุกแท็บให้แสดง popup + รีโหลดอัตโนมัติ
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ action: 'showUpdatePopup' });
      }
    })()
  );
});

// -------------------------------
// 🌐 FETCH HANDLER
// -------------------------------
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  try {
    const url = new URL(event.request.url);
    if (!url.protocol.startsWith('http')) return;
  } catch {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(resp => {
          if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match('./TripA-B.html'));
    })
  );
});

// -------------------------------
// 🔄 MESSAGE HANDLER
// -------------------------------
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] 🚀 Forcing new version activation...');
    self.skipWaiting();
  }
});

console.log(`[SW] ✅ TripA-B Service Worker ${CACHE_VERSION} ready.`);
