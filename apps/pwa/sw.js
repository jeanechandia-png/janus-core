const CACHE = 'janus-shell-v6';
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/app-install.js',
  '/pcm-capture-worklet.js',
  '/pcm-tts-player.js',
  '/manifest.webmanifest',
  '/icons/janus-icon-180.png',
  '/icons/janus-icon-192.png',
  '/icons/janus-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET'
    || url.pathname.startsWith('/api/')
    || url.pathname === '/health'
  ) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))),
  );
});
