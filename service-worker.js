// ===============================
// TripA-B Service Worker (v12 Final)
// ===============================

const CACHE_NAME = 'trip-ab-cache-v12';
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
  console.log('[SW] Installing...');
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
// ♻️ ACTIVATE
// -------------------------------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// -------------------------------
// 🌐 FETCH HANDLER (แก้จุดหลักตรงนี้)
// -------------------------------
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);

    // ✅ กันทุก protocol ที่ไม่ใช่ http(s)
    if (!url.protocol.startsWith('http')) return;

  } catch (e) {
    // URL แปลก เช่น data:, blob:
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(resp => {
          // ✅ cache เฉพาะ response ที่ปกติเท่านั้น
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
// 💾 IndexedDB สำหรับเก็บข้อมูลออฟไลน์
// -------------------------------
function saveTripOffline(tripData) {
  const request = indexedDB.open('tripDataDB', 1);
  request.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('trips')) {
      db.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
    }
  };
  request.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('trips', 'readwrite');
    tx.objectStore('trips').add(tripData);
  };
  request.onerror = e => console.error('[SW] IndexedDB save error:', e);
}

function getOfflineTrips() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tripDataDB', 1);
    request.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('trips', 'readonly');
      const store = tx.objectStore('trips');
      const getAll = store.getAll();
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = e => reject(e);
    };
    request.onerror = e => reject(e);
  });
}

self.addEventListener('sync', event => {
  if (event.tag === 'sync-trip-data') {
    console.log('[SW] Sync requested — static mode, no server to contact.');
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.action === 'manualSync') {
    console.log('[SW] Manual sync triggered — static host, skipping server sync.');
    getOfflineTrips().then(data => console.log('[SW] Offline trips:', data));
  }
});

console.log('[SW] TripA-B Service Worker v12 ready.');
