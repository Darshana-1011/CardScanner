const CACHE_NAME = 'card-catalog-v3';
const SAME_ORIGIN_ASSETS = [
  './tessdata-assets/worker.min.js',
  './tessdata-assets/tesseract-core.wasm.js',
  './tessdata-assets/tesseract-core.wasm',
  './tessdata-assets/eng.traineddata.gz'
];
const CROSS_ORIGIN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];
const ALL_HEAVY_ASSETS = SAME_ORIGIN_ASSETS.concat(CROSS_ORIGIN_ASSETS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Same-origin files: cache normally (readable response, full content preserved).
      const sameOrigin = SAME_ORIGIN_ASSETS.map((url) =>
        cache.add(url).catch(() => {})
      );
      // Genuinely cross-origin files: need no-cors mode just to be allowed into
      // the cache at all, since they don't send CORS headers. The resulting
      // "opaque" response is fine here because we only ever hand it straight
      // to a <script>/<link> tag, never read its contents in JS.
      const crossOrigin = CROSS_ORIGIN_ASSETS.map((url) =>
        cache.add(new Request(url, { mode: 'no-cors' })).catch(() => {})
      );
      return Promise.all(sameOrigin.concat(crossOrigin));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

function isHeavyAsset(url) {
  return ALL_HEAVY_ASSETS.some((a) => url.endsWith(a.replace('./', '')) || url === a);
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept the Google Sheet sync calls — those must always hit the network live.
  if (url.includes('script.google.com')) return;

  // Heavy OCR/library assets rarely change: serve from cache first (fast), fall back to network.
  if (isHeavyAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        });
      })
    );
    return;
  }

  // Everything else (the HTML page itself, etc.): always try the network first
  // so you see the latest version when online. Only use the cache if offline.
  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(event.request))
  );
});
