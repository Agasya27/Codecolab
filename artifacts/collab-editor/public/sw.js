const CACHE_NAME = 'codecollab-v4';
const APP_SHELL = ['/', '/index.html'];

// Skip these during fetch — never cache them
function shouldSkip(url) {
  const p = url.pathname;
  return (
    p.startsWith('/api/') ||
    p === '/ws' ||
    p.startsWith('/@') ||          // Vite internals (/@vite/, /@react-refresh, etc.)
    p.startsWith('/__') ||         // Vite and Replit internals (/__replco/, __hmr, etc.)
    p.startsWith('/node_modules/') ||
    url.protocol !== 'https:' && url.protocol !== 'http:'
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map(u => cache.add(u).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (shouldSkip(url)) return;

  if (request.mode === 'navigate') {
    // Network first for navigation — always try to get latest HTML
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then(r => r || caches.match('/'))
        )
    );
  } else {
    // Cache-first for other static assets
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          }
          return res;
        });
        return cached || networkFetch;
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
