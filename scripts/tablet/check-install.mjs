#!/usr/bin/env node
// Diagnóstico sin consumir APIs ni revelar claves. --runtime consulta solo el nodo local.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
let failures = 0;
function check(label, ok) { console.log(`${ok ? 'OK' : 'FALTA'} · ${label}`); if (!ok) failures++; }
try { await import('node:sqlite'); check('SQLite de Node', true); } catch { check('SQLite de Node', false); }
for (const file of ['prototypes/dashboard/dist/Janus-Core-A-public-safe.html', 'prototypes/dashboard/dist/Janus-Core-B-public-safe.html', 'apps/pwa/kendra.html', 'apps/pwa/founder-session.js']) {
  check(file, existsSync(join(root, file)));
}
for (const name of ['manifest.webmanifest', 'kendra.webmanifest']) {
  try {
    const manifest = JSON.parse(readFileSync(join(root, 'apps/pwa', name), 'utf8'));
    check(name, Boolean(manifest.id && manifest.start_url && manifest.display === 'standalone' && manifest.icons?.every(icon => existsSync(join(root, 'apps/pwa', icon.src)))));
  } catch { check(name, false); }
}
if (process.argv.includes('--runtime')) {
  const port = Number(process.env.PORT || 8787);
  try {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('port');
    const origin = `http://127.0.0.1:${port}`;
    const health = await fetch(origin + '/health', { signal: AbortSignal.timeout(5000), redirect: 'error' }).then(r => r.json());
    check('runtime Janus auténtico', health.ok === true && health.service === 'janus-runtime');
    check('memoria en SQLite persistente', health.durable === true && health.db === 'sqlite');
    console.log(`Acceso del propietario: ${health.authority?.founderConfigured ? 'registrado' : 'PENDIENTE de vincular este dispositivo'}`);
    for (const route of ['/dashboard/a', '/dashboard/b', '/kendra']) {
      const response = await fetch(origin + route, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      check(route, response.ok && /text\/html/.test(response.headers.get('content-type') || ''));
      await response.body?.cancel();
    }
    console.log(`IA conversacional: ${health.planner?.includes('+model') ? 'configurada; verificar respuesta real' : 'PENDIENTE de conectar modelo'}`);
    console.log(`Voz del núcleo: ${health.voice?.streaming?.state === 'available' ? 'configurada; verificar micrófono y audio reales' : 'PENDIENTE de conectar STT/TTS'}`);
  } catch { check('runtime accesible en esta tablet', false); }
}
console.log('Este diagnóstico no certifica el dispositivo físico ni los robots/criaturas.');
process.exitCode = failures ? 1 : 0;
