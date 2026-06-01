const CACHE_VERSION = '20260406';
const STATIC_CACHE = `app-static-${CACHE_VERSION}`;
const API_CACHE = `app-api-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/manifest.webmanifest?v=20260406',
  '/pwa/icon-192.png?v=20260406',
  '/pwa/icon-512.png?v=20260406',
  '/pwa/apple-touch-icon-180.png?v=20260406'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const accept = request.headers.get('accept') || '';
  const isHtmlRequest =
    request.destination === 'document' ||
    accept.includes('text/html') ||
    url.pathname.endsWith('.html');

  if (isHtmlRequest || url.pathname.endsWith('/sw.js') || url.pathname.endsWith('version.json')) {
    return;
  }

  const isStatic =
    ['style', 'script', 'image', 'font'].includes(request.destination) ||
    /\.(css|js|png|jpg|jpeg|svg|webp|ico|webmanifest)$/i.test(url.pathname);

  const isApi = url.pathname.startsWith('/api/') || url.pathname.startsWith('/dashboard/');

  if (isApi) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStatic) {
    event.respondWith(cacheFirst(request));
  }
});

function canCacheRequest(request) {
  try {
    const url = new URL(request.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (canCacheRequest(request) && response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch (cacheError) {
        console.warn('SW cache skip:', cacheError.message);
      }
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (canCacheRequest(request) && response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch (cacheError) {
      console.warn('SW cache skip:', cacheError.message);
    }
  }
  return response;
}
