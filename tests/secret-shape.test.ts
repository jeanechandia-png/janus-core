import assert from 'node:assert/strict';
import test from 'node:test';
import { findSecretLikeValues, isSecretReference, redactSecrets } from '../packages/automation/src/secret-shape.js';
import { redactSecrets as viaPersistence } from '../packages/automation/src/flow-run-persistence.js';

test('detecta claves y tokens escritos a mano, sin devolver nunca el valor', () => {
  const samples: Record<string, string> = {
    openai: 'sk-abcdefghijklmnopqrstuv', github: 'ghp_abcdefghijklmnopqrstuvwxyz', aws: 'AKIAABCDEFGHIJKLMNOP', slack: 'xoxb-1234567890-abcdef',
    google: 'AIzaSyA-1234567890abcdefghijklmnopqrstuv', pem: '-----BEGIN RSA PRIVATE KEY-----', bearer: 'Authorization: Bearer abcdefghijklmnop1234',
    jwt: 'eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY3.SflKxwRJSMeKKF2QT4fw', opaca: 'A'.repeat(48),
  };
  for (const [name, value] of Object.entries(samples)) {
    const findings = findSecretLikeValues({ campo: value });
    assert.equal(findings.length, 1, name);
    assert.equal(findings[0]!.path, 'campo');
    assert.equal(JSON.stringify(findings).includes(value), false, 'no repite el valor');
  }
});

test('por nombre de campo: solo cadenas escritas a mano; referencias, expresiones y números pasan', () => {
  assert.equal(findSecretLikeValues({ password: 'hunter2hunter2' }).length, 1);
  assert.equal(findSecretLikeValues({ a: { b: [{ api_key: 'valor-en-claro' }] } })[0]!.path, 'a.b[0].api_key');
  for (const safe of ['ref:janus/clave', 'vault:google/token', 'env:API_KEY', '{{ $vars.token }}', '$secretos.clave']) {
    assert.equal(findSecretLikeValues({ token: safe }).length, 0, safe);
    assert.equal(isSecretReference(safe), true);
  }
  assert.equal(findSecretLikeValues({ maxTokens: 500, token: '', password: null }).length, 0);
  assert.equal(findSecretLikeValues({ texto: 'Hola, esto es una frase normal con espacios y ninguna clave.' }).length, 0);
  assert.equal(findSecretLikeValues({ x: 'sk-corta' }).length, 0, 'demasiado corta para ser una clave');
  assert.equal(findSecretLikeValues({ a: 1 }, 'base')[0], undefined);
  assert.equal(findSecretLikeValues({ password: 'xxxxxxxx' }, 'base')[0]!.path, 'base.password');
});

test('redactSecrets conserva su comportamiento y sigue accesible desde la persistencia', () => {
  assert.equal(viaPersistence, redactSecrets);
  const { value, redactions } = redactSecrets({ ok: 1, token: 'abc', anidado: { password: 'x', lista: [{ apiKey: 'y' }] }, vacio: { secret: '' } });
  assert.equal(redactions, 3);
  assert.deepEqual(value, { ok: 1, token: '[redacted]', anidado: { password: '[redacted]', lista: [{ apiKey: '[redacted]' }] }, vacio: { secret: '' } });
});
