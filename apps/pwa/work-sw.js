// JANUS Work · service worker mínimo: SOLO avisos (recordatorios de la agenda). No guarda páginas ni datos en caché.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = typeof data.title === 'string' && data.title ? data.title : 'JANUS Work';
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === 'string' ? data.body : '',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    icon: '/icons/janus-icon-192.png',
    badge: '/icons/janus-icon-192.png',
    data: { url: '/work' }, // siempre el panel: un aviso no puede abrir otra dirección
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((client) => new URL(client.url).pathname.startsWith('/work'));
    return open ? open.focus() : self.clients.openWindow('/work');
  }));
});
