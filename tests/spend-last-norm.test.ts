import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseFounderReferenceLibrary } from '../packages/core/src/founder-reference-library.js';
import { buildFounderPhoneChannelRegistry, planPhoneAccess } from '../packages/core/src/founder-phone-channels.js';

// Norma 7 (2026-10-23): el gasto va al final.

test('la política "el gasto va al final" está en la biblioteca pública y fija euros, reposo y pago por el Founder', () => {
  const library = parseFounderReferenceLibrary(JSON.parse(readFileSync('config/founder-reference-library.json', 'utf8')));
  const policy = library.records.find((record) => record.subject === 'founder-policy:spend-last');
  assert.ok(policy, 'falta founder-policy:spend-last');
  assert.equal(policy.kind, 'policy');
  assert.equal(policy.retention, 'preserve');
  for (const phrase of ['último recurso', 'en reposo', 'euros', 'El pago lo hace el Founder']) {
    assert.ok(policy.value.includes(phrase), `la política debe decir «${phrase}»`);
  }
});

test('el registro de capacidades en reposo existe y cubre correo, redes, WhatsApp/llamadas y servidor, con precios en euros', () => {
  assert.ok(existsSync('docs/dormant-capabilities.md'));
  const text = readFileSync('docs/dormant-capabilities.md', 'utf8');
  for (const topic of ['Correo', 'Vigilancia periódica de redes', 'WhatsApp, SMS y llamadas', 'Motor (runtime)', 'Registro de gasto']) {
    assert.ok(text.includes(topic), `falta «${topic}»`);
  }
  assert.ok(!/\$\s?\d|\d\s?(USD|dólares)/i.test(text), 'los precios van siempre en euros, nunca en dólares');
  assert.match(text, /€/);
});

test('el acceso al teléfono recomienda siempre una ruta sin gasto', () => {
  const document = parseFounderReferenceLibrary({
    schemaVersion: 1,
    ownerPrincipalId: 'founder',
    updatedAt: '2026-10-23T00:00:00.000Z',
    records: [{ id: 'phone-test', subject: 'founder-reference:test:phone-test', kind: 'reference', classification: 'current', label: 'Teléfono de prueba', value: '+31612345678', retention: 'preserve', tags: ['phone', 'voice', 'sms', 'whatsapp', 'scope:personal'] }],
  });
  const { channels } = buildFounderPhoneChannelRegistry(document);
  const plans = planPhoneAccess(channels, { adapters: new Set() });
  assert.ok(plans.length > 0);
  for (const plan of plans) {
    const recommended = plan.routes.find((route) => route.routeId === plan.recommendedFirstRoute);
    assert.ok(recommended, 'debe haber una ruta recomendada');
    assert.equal(recommended.spend, false, 'la ruta recomendada no puede costar dinero');
  }
});
