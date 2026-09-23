const CACHE_NAME = 'card-catalog-v2';
const HEAVY_ASSETS = [
  './tessdata-assets/worker.min.js',
  './tessdata-assets/tesseract-core.wasm.js',
  './tessdata-assets/tesseract-core.wasm',
  './tessdata-assets/eng.traineddata.gz',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        HEAVY_ASSETS.map((url) =>
          cache.add(new Request(url, { mode: 'no-cors' })).catch(() => {})
        )
      );
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
  return HEAVY_ASSETS.some((a) => url.endsWith(a.replace('./', '')) || url === a);
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept the Google Sheet sync calls — those must always hit the network live.
  if (url.includes('script.google.com')) return;

  // Heavy OCR assets rarely change: serve from cache first (fast), fall back to network.
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
