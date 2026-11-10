const CACHE = 'janus-shell-v17';
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/attach.js',
  '/app-install.js',
  '/glow-emblem.js',
  '/founder-session.js',
  '/knowledge-review.js',
  '/dashboard-access.js',
  '/team-panel.js',
  '/dashboard-access.css',
  '/language-buttons.js',
  '/language-buttons.css',
  '/approved-presence.js',
  '/approved-presence.css',
  '/approved-3d/vendor/three-r160.min.js',
  '/approved-3d/vendor/gltf-kit.js',
  '/approved-3d/janus-creature-slot.js',
  '/language-art/nederland.webp.b64',
  '/language-art/espana.webp.b64',
  '/pcm-capture-worklet.js',
  '/pcm-tts-player.js',
  '/manifest.webmanifest',
  '/kendra',
  '/kendra.html',
  '/kendra.css',
  '/kendra.js',
  '/kendra-parent.js',
  '/kendra-creatures.js',
  '/kendra.webmanifest',
  '/icons/kendra-180.png',
  '/icons/kendra-192.png',
  '/icons/kendra-512.png',
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
    || url.origin !== self.location.origin
    || url.pathname.startsWith('/api/')
    || url.pathname === '/health'
  ) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && !/no-store/i.test(response.headers.get('cache-control') || '')) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(async (cached) => {
        if (cached) return cached;
        if (request.mode !== 'navigate') return Response.error();
        const shell = await caches.match(url.pathname === '/kendra' || url.pathname.startsWith('/kendra/') ? '/kendra' : '/');
        return shell || new Response('JANUS está sin conexión. Vuelve a abrir la app cuando el servidor esté disponible.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      })),
  );
});
