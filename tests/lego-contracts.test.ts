// Guardia anti-obsolescencia (complementa lego-module-boundaries.test.ts, que valida manifiesto, README y entrada):
// las piezas autónomas no dependen de nada externo y los datos que caducan llevan fecha de revisión y fuentes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = 'packages/modules';
const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => { const full = join(dir, name); return statSync(full).isDirectory() ? files(full) : /\.ts$/.test(name) ? [full] : []; });

test('las piezas autónomas no importan nada fuera de su carpeta y documentan límites e invariantes', () => {
  for (const name of ['company-books', 'nl-tax-prep', 'contextual-interpreter', 'offline-kit']) {
    const manifest = JSON.parse(readFileSync(join(ROOT, name, 'module.json'), 'utf8'));
    assert.deepEqual(manifest.dependencies, [], `${name}: sin dependencias`);
    assert.ok(manifest.invariants.length >= 4 && manifest.knownLimits.length >= 1 && manifest.reuseNotes, `${name}: invariantes, límites y notas de reutilización`);
    for (const file of files(join(ROOT, name, 'src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)) assert.ok(match[1]!.startsWith('./'), `${file} importa ${match[1]}`);
      // Sin internet deben seguir funcionando: ninguna llamada de red dentro de la pieza.
      assert.doesNotMatch(readFileSync(file, 'utf8'), /\bfetch\s*\(|XMLHttpRequest|node:https?|WebSocket\s*\(/, `${file} usa la red`);
    }
  }
});

test('los datos que caducan (reglas fiscales) llevan fecha de revisión y fuentes https', () => {
  const dir = join(ROOT, 'nl-tax-prep', 'packs');
  for (const name of readdirSync(dir)) {
    const pack = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    assert.match(name, new RegExp(`^nl-${pack.year}\\.json$`));
    assert.match(pack.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const [key, param] of Object.entries(pack.params) as Array<[string, { sources: string[] }]>) assert.ok(param.sources.length >= 1 && param.sources.every((id) => /^https:\/\//.test(pack.sources[id].url)), `${name}: ${key} sin fuente`);
  }
});
