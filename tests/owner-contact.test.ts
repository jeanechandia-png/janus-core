import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadOwnerContact,
  normalizeDutchMobile,
  OwnerContactError,
  parseOwnerContact,
  whatsappUrl,
} from '../packages/core/src/owner-contact.js';

test('Dutch mobile numbers normalize to E.164 from every dictated shape', () => {
  for (const raw of ['640-61-3413', '06 40613413', '0640613413', '+31 6 40613413', '0031640613413', '31640613413']) {
    assert.deepEqual(normalizeDutchMobile(raw), { e164: '+31640613413', display: '+31 6 40613413' }, raw);
  }
  assert.equal(whatsappUrl('+31640613413'), 'https://wa.me/31640613413');
});

test('non-mobile or malformed numbers are rejected', () => {
  for (const raw of ['0201234567', '12345', '+1 212 555 0100', '']) {
    assert.throws(() => normalizeDutchMobile(raw), OwnerContactError, raw);
  }
});

test('profile dedupes emails, lowercases them and refuses the banned address', () => {
  const profile = parseOwnerContact({
    displayName: 'Test',
    emails: [
      { address: 'A@Example.com', label: 'A', role: 'personal' },
      { address: 'a@example.com', label: 'dup', role: 'personal' },
    ],
    phones: [{ label: 'Móvil', number: '0640613413', whatsapp: true }],
  });
  assert.equal(profile.emails.length, 1);
  assert.equal(profile.emails[0]!.address, 'a@example.com');
  assert.throws(
    () => parseOwnerContact({ displayName: 'T', emails: [{ address: 'zero30008@hotmail.com', label: 'x', role: 'x' }] }),
    /prohibido/,
  );
  assert.throws(() => parseOwnerContact({ displayName: 'T', emails: [{ address: 'sin-arroba', label: 'x', role: 'x' }] }), OwnerContactError);
  assert.throws(() => parseOwnerContact({ displayName: 'T' }), /correos ni teléfonos/);
});

test('missing private file is a normal unconfigured state; malformed JSON is an error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-contact-'));
  const snapshot = loadOwnerContact(join(dir, 'nope.json'));
  assert.equal(snapshot.configured, false);
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{not json');
  assert.throws(() => loadOwnerContact(bad), OwnerContactError);
  const good = join(dir, 'good.json');
  writeFileSync(good, JSON.stringify({
    displayName: 'Jean',
    emails: [{ address: 'x@example.com', label: 'X', role: 'personal', needsConfirmation: true }],
    phones: [{ label: 'Móvil', number: '640-61-3413', whatsapp: true }],
  }));
  const loaded = loadOwnerContact(good);
  assert.equal(loaded.configured, true);
  if (loaded.configured) {
    assert.equal(loaded.whatsappLinks[0]!.url, 'https://wa.me/31640613413');
    assert.equal(loaded.profile.emails[0]!.needsConfirmation, true);
  }
});
