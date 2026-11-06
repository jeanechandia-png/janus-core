import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFounderReferenceLibrary } from '../packages/core/src/founder-reference-library.js';

test('norma universal de 14 filtros se carga en la biblioteca runtime sin duplicar políticas', () => {
  const library = parseFounderReferenceLibrary(JSON.parse(readFileSync('config/founder-reference-library.json', 'utf8')));
  const values = library.records.filter(record => record.subject === 'founder-policy:delivery-filters');
  assert.equal(values.length, 1);
  const policy = values[0]!;
  assert.equal(policy.classification, 'current');
  assert.equal(policy.kind, 'policy');
  assert.equal(policy.retention, 'preserve');

  for (const requirement of [
    'veracidad', 'ortografía e i18n', 'síntesis', 'estructura',
    'coherencia visual', 'composición arquitectónica',
    'arquitectura de software', 'funcionalidad', 'seguridad/privacidad',
    'responsividad/compatibilidad', 'rendimiento/costes',
    'integridad histórica', 'E2E', 'entrega final',
    'cada PASS', 'evidencia',
  ]) {
    assert.ok(policy.value.toLowerCase().includes(requirement.toLowerCase()), 'falta ' + requirement);
  }
  assert.match(policy.value, /segunda pasada/);
  assert.match(policy.value, /vista previa/);
  assert.match(policy.value, /verificación independiente/);
  assert.match(policy.value, /npm run pilot:gate/);

  // El protocolo nuevo debe extender, no eliminar, normas vigentes.
  for (const subject of [
    'founder-policy:continuity-no-duplication',
    'founder-policy:school-safety',
    'founder-policy:spend-last',
    'founder-policy:kendra-shared-cartoon-voice',
    'founder-policy:independent-first-no-external-credits',
  ]) {
    assert.equal(library.records.filter(item => item.subject === subject).length, 1, 'falta ' + subject);
  }
});
