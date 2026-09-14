// ============================================================
// TripA-B Service Worker — Stable Auto Update
//
// หลักการ:
// 1) TripA-B.html = NETWORK FIRST → อัปเดตไฟล์ HTML จาก GitHub Pages ทันที
// 2) ถ้าเน็ตล่ม → ใช้ HTML ที่เก็บไว้เป็น fallback
// 3) API ภายนอก (MapTiler / OSRM / Overpass / Nominatim / Photon ฯลฯ)
//    ไม่ถูก cache โดย Service Worker
// 4) ไฟล์ static ขนาดเล็ก เช่น manifest/icon ใช้ cache ได้
// 5) SW ใช้ชื่อ/เวอร์ชันคงที่ได้ ไม่ต้องแก้ SW ทุกครั้งที่แก้ TripA-B.html
// ============================================================

const CACHE_VERSION = 'trip-ab-shell-v20';
const CACHE_NAME = CACHE_VERSION;

// เฉพาะไฟล์ static ที่ไม่ใช่ตัวแอปหลัก
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const APP_FILE = 'TripA-B.html';

// ------------------------------------------------------------
// INSTALL
// ------------------------------------------------------------
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // ถ้า asset ตัวใดตัวหนึ่งไม่มี จะไม่ทำให้ SW install ล้มทั้งหมด
    await Promise.all(
      STATIC_ASSETS.map(async asset => {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Static asset cache skipped:', asset, err);
        }
      })
    );

    // เปิดใช้งาน SW ใหม่ทันที
    await self.skipWaiting();
  })());
});

// ------------------------------------------------------------
// ACTIVATE
// ------------------------------------------------------------
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key.startsWith('trip-ab-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );

    // ให้ SW ใหม่ควบคุมหน้าเว็บทันที
    await self.clients.claim();
  })());
});

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function isAppHtml(url) {
  return url.pathname.endsWith('/TripA-B.html') ||
         url.pathname.endsWith('/TripA-B.htm');
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  if (!isSameOrigin(url)) return false;

  return url.pathname.endsWith('/manifest.json') ||
         url.pathname.endsWith('/icon-192.png') ||
         url.pathname.endsWith('/icon-512.png');
}

// ------------------------------------------------------------
// FETCH
// ------------------------------------------------------------
self.addEventListener('fetch', event => {
  const request = event.request;

  // เฉพาะ GET เท่านั้น
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ปล่อย request ที่ไม่ใช่ HTTP(S) ผ่านไป
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // ==========================================================
  // 1) TripA-B.html → NETWORK FIRST
  // ==========================================================
  // สำคัญที่สุด: เมื่อผู้ใช้ upload TripA-B.html ใหม่
  // browser จะขอไฟล์จาก network ก่อน จึงไม่ติด HTML เก่าใน cache
  if (isAppHtml(url)) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request, {
          cache: 'no-store'
        });

        // เก็บ HTML ล่าสุดไว้เป็น offline fallback
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        // รองรับกรณี URL มี query string
        const fallback = await caches.match('./TripA-B.html');
        if (fallback) return fallback;

        return new Response(
          'TripA-B ไม่สามารถโหลดได้ในขณะออฟไลน์',
          {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          }
        );
      }
    })());
    return;
  }

  // ==========================================================
  // 2) API / CDN / Map / Routing → ไม่ cache
  // ==========================================================
  // ป้องกัน Service Worker ไปยุ่งกับ:
  // MapTiler, MapLibre CDN, OSRM, Overpass, Nominatim, Photon ฯลฯ
  if (!isSameOrigin(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // ==========================================================
  // 3) Static local assets → cache first + network fallback
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
        return new Response('', { status: 503 });
      }
    })());
    return;
  }

  // ==========================================================
  // 4) ไฟล์ local อื่น ๆ → network first, cache fallback
  // ==========================================================
  // ไม่ cache แบบครอบจักรวาล เพื่อไม่ให้ข้อมูล/ไฟล์ใหม่ค้างโดยไม่จำเป็น
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch (err) {
      const cached = await caches.match(request);
      return cached || new Response('', { status: 503 });
    }
  })());
});

// ------------------------------------------------------------
// MESSAGE
// ------------------------------------------------------------
self.addEventListener('message', event => {
  const data = event.data;

  if (data === 'SKIP_WAITING' || data?.action === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }

  // รองรับโค้ดเดิมของ TripA-B ที่ส่ง manualSync
  // แต่ไม่มีการทำ network request ปลอม/ไม่มี Response ผิดชนิด
  if (data?.action === 'manualSync') {
    // ตั้งใจไม่ทำอะไร เพราะ TripA-B ใช้ IndexedDB/localStorage
    // เป็นหลัก และไม่มี server endpoint สำหรับ sync ที่กำหนดไว้
  }
});
