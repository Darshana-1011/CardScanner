const CACHE_NAME = 'card-catalog-v1';
const ASSETS_TO_CACHE = [
  './',
  './card-catalog.html',
  './tessdata-assets/worker.min.js',
  './tessdata-assets/tesseract-core.wasm.js',
  './tessdata-assets/tesseract-core.wasm',
  './tessdata-assets/eng.traineddata.gz',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
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

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  // Never intercept the Google Sheet sync calls — those must always hit the network live.
  if (url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() => cached);
    })
  );
});
