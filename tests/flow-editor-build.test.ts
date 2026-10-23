import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// El editor de flujos se entrega como UN solo HTML. Estas comprobaciones son estáticas: confirman que el archivo no puede
// hablar con la red ni ejecutar texto como código. La prueba en navegador real vive en scripts/flow-editor-e2e.mjs.
test('el HTML del editor de flujos es autónomo: sin URLs, sin red, sin eval y con una política CSP cerrada', () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-flow-editor-'));
  try {
    const out = join(dir, 'janus-flujos.html');
    const run = spawnSync(process.execPath, ['scripts/build-flow-editor.mjs', out], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const html = readFileSync(out, 'utf8');
    assert.ok(html.startsWith('<!doctype html>') && html.length > 20_000);
    assert.match(html, /http-equiv="Content-Security-Policy" content="default-src 'none'[^"]*connect-src 'none'/);
    assert.equal((html.match(/<script>/g) ?? []).length, 1, 'un solo bloque de script');
    assert.deepEqual(html.match(/https?:\/\/[^\s"')]+/g) ?? [], [], 'ninguna URL externa dentro del archivo');
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource', 'importScripts', 'eval(', 'new Function', 'document.write']) {
      assert.ok(!html.includes(forbidden), `no debe contener ${forbidden}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('el código fuente del editor no usa red ni inserta texto sin escapar', () => {
  const source = readFileSync('apps/flow-editor/src/browser.ts', 'utf8');
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'eval(', 'new Function', 'document.write', 'outerHTML =']) {
    assert.ok(!source.includes(forbidden), `browser.ts no debe contener ${forbidden}`);
  }
  // Todo dato de un borrador que llega a una plantilla HTML pasa por esc(); las únicas interpolaciones sin esc() son números y HTML propio.
  const risky = source.split('\n').filter((line) => line.includes('<')).flatMap((line) => [...line.matchAll(/\$\{(?:node|n|c|p|e|v|t|h|b|from|to|s|wf)\.(?:label|id|type|text|name|branch|description|reason|hint)\}/g)].map((m) => m[0]));
  assert.deepEqual(risky, [], 'interpolación de texto de borrador sin esc()');
});
