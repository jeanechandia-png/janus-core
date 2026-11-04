'use strict';
/**
 * JANUS Dashboard A/B · adaptador local del Núcleo.
 *
 * Levanta la PWA original + dashboard A/B bajo UN MISMO ORIGEN, con todas las
 * peticiones /api/*, /health, /founder-session.js enviadas a Janus Core local.
 * Esto permite reutilizar la sesión P-256/Founder de la PWA, no crear otra
 * autoridad ni copiar tokens al HTML. Sin paquetes extra, sin cloud.
 *
 * Por defecto SOLO escucha 127.0.0.1; para acceso desde otro dispositivo
 * debe existir una terminación HTTPS confiable/autorizada por el Founder.
 * Nunca expone servicios LAN ni modifica producción automáticamente.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const port = Number(process.env.JANUS_DASH_PORT || '8765');
const host = '127.0.0.1';
const upstream = new URL(process.env.JANUS_CORE_URL || 'http://127.0.0.1:3000');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto JANUS_DASH_PORT inválido.');
if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname) || upstream.username || upstream.password || (upstream.pathname !== '/' && upstream.pathname !== '')) {
  throw new Error('JANUS_CORE_URL debe apuntar a localhost HTTP. Se rechazan servidores remotos y credenciales en URL.');
}

function compile() {
  const a = path.join(ROOT, 'dist/Janus-A-Obsidiana-interactivo.html');
  const b = path.join(ROOT, 'dist/Janus-B-Platino-interactivo.html');
  for (const [name, target] of [['a', a], ['b', b]]) {
    if (!fs.existsSync(target) || process.env.JANUS_DASH_REBUILD === '1') {
      execFileSync(process.execPath, [path.join(ROOT, 'build.cjs'), '--skin', name], {
        cwd: ROOT, stdio: 'inherit', timeout: 60_000,
      });
    }
  }
  return { a, b };
}

const dashboards = compile();

function isSameHost(request) {
  const hostHeader = String(request.headers.host || '').toLowerCase();
  return hostHeader === '127.0.0.1:' + port || hostHeader === 'localhost:' + port;
}
function safeOrigin(request) {
  const header = request.headers.origin;
  if (!header) return true;
  try {
    const u = new URL(header);
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && Number(u.port) === port;
  } catch (_) { return false; }
}
const reject = (res, code, message) => {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(message);
};

function proxy(req, res) {
  const headers = { ...req.headers, host: upstream.host };
  delete headers['proxy-authorization'];
  const upstreamReq = http.request({
    protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port || 80,
    path: req.url, method: req.method, headers, timeout: 120_000,
  }, (remote) => {
    // Headers are copied from the authoritative Core response, not synthesized.
    res.writeHead(remote.statusCode || 502, {
      ...remote.headers, 'x-content-type-options': 'nosniff',
      'cache-control': remote.headers['cache-control'] || 'no-store',
    });
    remote.pipe(res);
  });
  upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('JANUS CORE no respondió a tiempo')));
  upstreamReq.on('error', () => {
    if (!res.headersSent) reject(res, 502, 'JANUS CORE no está disponible en el puerto local configurado.');
    else res.destroy();
  });
  req.pipe(upstreamReq);
}

const server = http.createServer((req, res) => {
  if (!isSameHost(req)) { reject(res, 403, 'Host rechazado'); return; }
  if (!['GET', 'HEAD', 'POST', 'OPTIONS'].includes(req.method || '')) { reject(res, 405, 'Método no permitido'); return; }
  const u = new URL(req.url || '/', 'http://localhost');
  if (!safeOrigin(req) && req.method !== 'GET' && req.method !== 'HEAD') {
    reject(res, 403, 'Origen no autorizado'); return;
  }
  if (u.pathname === '/dashboard' || u.pathname === '/dashboard/') {
    res.writeHead(302, { location: '/dashboard/a', 'cache-control': 'no-store' }); res.end(); return;
  }
  if (u.pathname === '/dashboard/a' || u.pathname === '/dashboard/b') {
    if (req.method !== 'GET' && req.method !== 'HEAD') { reject(res, 405, 'Solo lectura'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(dashboards[u.pathname.endsWith('/a') ? 'a' : 'b']).on('error', () => res.destroy()).pipe(res);
    return;
  }
  // Solo el runtime local resuelve la PWA original y sus APIs. Se conserva su
  // autenticación, validación de permisos, SSE y rutas de aprobación.
  proxy(req, res);
});
server.on('clientError', (_err, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); });
server.listen(port, host, () => {
  console.log('JANUS Dashboard A/B + PWA: http://' + host + ':' + port + '/dashboard/a');
  console.log('Janus Core local: ' + upstream.origin + ' · no se ha publicado a Internet');
});
