/* ChronoClassics service worker — installable PWA + offline resilience.
   Strategy:
   - Navigations (HTML): network-first → always fresh content, falls back to cache offline.
   - Static assets: cache-first → fast repeat loads, updated in the background.
   - /api/ and /.netlify/ (live eBay data): never cached — always network.
   - Cross-origin (Google Fonts, eBay images, analytics): passed straight through.
   Bump CACHE_VERSION on major asset changes to retire the old cache. */
const CACHE_VERSION = 'cc-cache-v1';

const APP_SHELL = [
  '/',
  '/styles.css',
  '/assets/new-logo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Let cross-origin requests (fonts, eBay images, GA) go straight to network.
  if (url.origin !== self.location.origin) return;

  // Never cache live API / serverless functions — listings must always be fresh.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;

  // HTML navigations: network-first, fall back to cache (then homepage) when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the fresh copy).
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
