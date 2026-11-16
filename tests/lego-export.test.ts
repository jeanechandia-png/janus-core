import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
// @ts-expect-error módulo .mjs sin tipos
import { exportPieces, verifyExport } from '../scripts/lego-export.mjs';

test('exportar piezas a otro producto: copia sellada, verificable y que detecta cualquier cambio', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lego-export-'));
  try {
    const lock = exportPieces(dir, ['company-books', 'nl-tax-prep'], { commit: 'abc123' });
    assert.deepEqual(Object.keys(lock.pieces), ['company-books', 'nl-tax-prep']);
    assert.equal(lock.pieces['nl-tax-prep'].sourceCommit, 'abc123');
    assert.ok(lock.pieces['nl-tax-prep'].files['packs/nl-2026.json'], 'las reglas fiscales viajan con la pieza');
    assert.deepEqual(verifyExport(dir), []);
    assert.match(execFileSync(process.execPath, [join(dir, 'verify-lego.mjs')], { encoding: 'utf8' }), /lego ok/);
    // La copia exportada es idéntica a la fuente.
    assert.equal(readFileSync(join(dir, 'company-books/src/index.ts'), 'utf8'), readFileSync('packages/modules/company-books/src/index.ts', 'utf8'));
    appendFileSync(join(dir, 'company-books/src/index.ts'), '\n// cambio local');
    writeFileSync(join(dir, 'nl-tax-prep/extra.ts'), 'export {};');
    const problems = verifyExport(dir);
    assert.ok(problems.some((p: string) => /company-books: src\/index\.ts fue modificado/.test(p)));
    assert.ok(problems.some((p: string) => /archivo añadido/.test(p)));
    assert.throws(() => execFileSync(process.execPath, [join(dir, 'verify-lego.mjs')], { stdio: 'pipe' }));
    // Reexportar restaura la copia.
    exportPieces(dir, ['company-books', 'nl-tax-prep'], { commit: 'def456' });
    assert.deepEqual(verifyExport(dir), []);
    assert.throws(() => exportPieces(dir, ['../x']), /no válido/);
    const withUi = exportPieces(dir, ['ui:janus-offline'], { commit: 'abc' });
    assert.equal(withUi.pieces['ui-janus-offline'].version, '1.2.0');
    assert.ok(withUi.pieces['ui-janus-offline'].files['janus-offline.js']);
    assert.deepEqual(verifyExport(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
