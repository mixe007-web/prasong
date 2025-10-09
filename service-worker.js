// ===============================
// TripA-B Service Worker (v13 Auto-Update)
// ===============================

const CACHE_VERSION = 'v13'; // 🆕 เปลี่ยนเลขนี้ทุกครั้งที่อัปโหลด
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
  self.skipWaiting(); // ✅ ติดตั้งทันที
});

// -------------------------------
// ♻️ ACTIVATE (ล้าง cache เก่า)
// -------------------------------
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] 🧹 Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// -------------------------------
// 🌐 FETCH HANDLER
// -------------------------------
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
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
// 🔄 AUTO-UPDATE LOGIC
// -------------------------------
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] 🚀 Skipping waiting, activating new version now...');
    self.skipWaiting();
  }
});

console.log(`[SW] TripA-B Service Worker ${CACHE_VERSION} ready.`);
