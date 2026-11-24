import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { quietMoment, registerWithAutoUpdate } from '../apps/pwa/pwa-update.js';

const root = resolve(import.meta.dirname, '..');

test('pwa-update: recarga solo en un momento tranquilo (oculta o 60 s sin tocar)', () => {
  assert.equal(quietMoment({ hidden: true, lastInputAt: 1000, now: 1000 }), true);
  assert.equal(quietMoment({ hidden: false, lastInputAt: 1000, now: 30_000 }), false, 'Kendra está jugando: no se corta');
  assert.equal(quietMoment({ hidden: false, lastInputAt: 1000, now: 61_000 }), true);
});

test('pwa-update: la primera instalación no recarga; una versión nueva sí, al quedar oculta', async () => {
  const listeners: Record<string, (() => void)[]> = {};
  const on = (t: string, f: () => void) => { (listeners[t] ??= []).push(f); };
  let reloads = 0; let updates = 0;
  const doc = { visibilityState: 'visible', addEventListener: on };
  const sw = { controller: {}, addEventListener: on, register: async () => ({ update: async () => { updates += 1; } }) };
  const win = { navigator: { serviceWorker: sw }, document: doc, location: { reload: () => { reloads += 1; } }, addEventListener: on, setInterval: () => 0 };
  await registerWithAutoUpdate('/sw.js', win);
  listeners.controllerchange!.forEach((f) => f());
  assert.equal(reloads, 0, 'visible y recién tocada: espera');
  doc.visibilityState = 'hidden'; listeners.visibilitychange!.forEach((f) => f());
  assert.equal(reloads, 1);
  doc.visibilityState = 'visible'; listeners.visibilitychange!.forEach((f) => f());
  assert.ok(updates >= 1, 'al volver a la app pregunta por versión nueva');

  const first = { ...win, navigator: { serviceWorker: { ...sw, controller: null } }, location: { reload: () => { reloads += 10; } } };
  await registerWithAutoUpdate('/sw.js', first);
  listeners.controllerchange!.at(-1)!();
  assert.equal(reloads, 1, 'primera instalación: no recarga');
});

test('pwa-update: lo usan el dashboard, la tablet de Kendra y la PWA clásica, y va en la caché', () => {
  for (const f of ['apps/pwa/kendra.js', 'apps/pwa/dashboard-access.js', 'apps/pwa/app.js']) {
    const s = readFileSync(resolve(root, f), 'utf8');
    assert.match(s, /registerWithAutoUpdate\('\/sw\.js'\)/, f);
    assert.doesNotMatch(s, /serviceWorker\.register\(/, `${f}: un solo camino de registro`);
  }
  assert.match(readFileSync(resolve(root, 'apps/pwa/sw.js'), 'utf8'), /'\/pwa-update\.js'/);
});
