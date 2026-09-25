// ============================================================
// TripA-B Service Worker — API SAFE / Stable Auto Update
// V23
//
// IMPORTANT:
// - Only same-origin TripA-B.html is handled by this SW.
// - Cross-origin API/CDN/map requests are NOT intercepted at all.
//   The browser handles them normally, eliminating SW Response-conversion
//   errors and avoiding interference with CORS/API responses.
// - Future normal app updates require uploading TripA-B.html only.
// - TripA-B.html is always requested from Network first (cache: no-store).
// - V23 keeps the same API-safe fetch policy and only rotates the shell cache version.
// - The cached HTML is used only when Network is unavailable.
// ============================================================

const CACHE_VERSION = 'trip-ab-shell-v23';
const CACHE_NAME = CACHE_VERSION;
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_ASSETS.map(async asset => {
      try { await cache.add(asset); }
      catch (err) { console.warn('[SW] Static asset cache skipped:', asset, err); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('trip-ab-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAppHtml(url) {
  return isSameOrigin(url) && (
    url.pathname.endsWith('/TripA-B.html') ||
    url.pathname.endsWith('/TripA-B.htm')
  );
}

function isStaticAsset(url) {
  return isSameOrigin(url) && (
    url.pathname.endsWith('/manifest.json') ||
    url.pathname.endsWith('/icon-192.png') ||
    url.pathname.endsWith('/icon-512.png')
  );
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // ==========================================================
  // 1) Cross-origin requests: DO NOT intercept.
  // ==========================================================
  // This is deliberately a plain `return`, not `respondWith(fetch(...))`.
  // That leaves MapTiler / OSRM / Overpass / Nominatim / Photon / CDN
  // completely outside the service worker fetch pipeline.
  if (!isSameOrigin(url)) return;

  // ==========================================================
  // 2) App HTML: network first, cached fallback.
  // ==========================================================
  if (isAppHtml(url)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fallback = await caches.match('./TripA-B.html');
        if (fallback) return fallback;
        return new Response('TripA-B ไม่สามารถโหลดได้ในขณะออฟไลน์', {
          status: 503,
          headers: {'Content-Type':'text/plain; charset=utf-8'}
        });
      }
    })());
    return;
  }

  // ==========================================================
  // 3) Small local static assets: cache first.
  // ==========================================================
  if (isStaticAsset(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        return new Response('', {status:503});
      }
    })());
    return;
  }

  // Everything else on the same origin is left to the browser.
  // No catch-all respondWith, no fake Response, no API interception.
});

self.addEventListener('message', event => {
  const data = event.data;
  if (data === 'SKIP_WAITING' || data?.action === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
  // Legacy manualSync is intentionally a no-op.
});
