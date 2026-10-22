'use strict';
// Empaqueta el dashboard como app instalable (PWA): index.html + manifest + service worker + iconos.
// Uso: node tools/pwa.cjs <html construido> <carpeta salida>
const fs = require('fs'), path = require('path');
const [, , SRC, OUT] = process.argv;
const D = path.join(__dirname, '..');
fs.mkdirSync(OUT, { recursive: true });
const ver = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
let html = fs.readFileSync(SRC, 'utf8');
const head = '<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#0a0908">\n<meta name="apple-mobile-web-app-title" content="Janus">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<link rel="apple-touch-icon" href="icon-180.png">\n<link rel="icon" href="icon-192.png">\n';
html = html.replace('<title>Janus · Obsidiana</title>', '<title>Janus</title>\n' + head);
html = html.replace('</body>', '<script>if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));</script>\n</body>');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({ name: 'Janus', short_name: 'Janus', description: 'Asistente personal y panel de mando de Jean · InfinitySeed', lang: 'es', start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: '#0a0908', theme_color: '#0a0908', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 1));
fs.writeFileSync(path.join(OUT, 'sw.js'), "const C='janus-" + ver + "',F=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];\n" +
  "self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});\n" +
  "self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});\n" +
  "self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html'))))});\n");
for (const f of ['icon-180.png', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(D, 'pwa', f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify({ headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Content-Type-Options', value: 'nosniff' }] }, { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }] }, null, 1));
console.log('PWA lista en', OUT, '· versión', ver);
