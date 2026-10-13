import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretTranscript, transcriptionVocabularyPrompt } from '../packages/core/src/transcript-interpretation.js';

// Real examples dictated by the Founder on 2026-10-13.
const CONTEXT = ['Estamos trabajando en Janus, ChatBox e IBA de InfinitySeed Group.'];

test('real case: "Llanos" in an ecosystem conversation resolves to Janus, original preserved', () => {
  const r = interpretTranscript({ text: 'esto es un ejemplo de lo que debemos aplicar en Llanos', context: CONTEXT });
  assert.equal(r.originalText, 'esto es un ejemplo de lo que debemos aplicar en Llanos');
  assert.equal(r.interpretedText, 'esto es un ejemplo de lo que debemos aplicar en Janus');
  assert.equal(r.corrections[0]?.basis, 'contextual_alias');
});

test('"Llanos" without ecosystem context keeps its ordinary meaning (plains)', () => {
  const r = interpretTranscript({ text: 'Viajamos a los Llanos Orientales de Colombia' });
  assert.equal(r.corrections.length, 0);
  assert.equal(r.interpretedText, r.originalText);
});

test('weak context only suggests and asks, it does not rewrite', () => {
  const r = interpretTranscript({ text: 'revisa el ChatBox y luego lo de Llanos' });
  assert.equal(r.interpretedText, r.originalText);
  assert.equal(r.needsConfirmation, true);
  assert.match(r.confirmationPrompt ?? '', /Janus/);
});

test('real cases: "Infinity Group" and "Infinity Shift" resolve to InfinitySeed Group', () => {
  assert.equal(interpretTranscript({ text: 'la landing de Infinity Group' }).interpretedText, 'la landing de InfinitySeed Group');
  assert.equal(interpretTranscript({ text: 'La denominación Infinity Shift ha sido mencionada' }).interpretedText,
    'La denominación InfinitySeed Group ha sido mencionada');
});

test('IVA means IBA only in product context, never next to tax vocabulary', () => {
  const tax = interpretTranscript({ text: 'el IVA de la factura es 21%', context: CONTEXT });
  assert.equal(tax.corrections.length, 0);
  const product = interpretTranscript({ text: 'el estado de IVA y ChatBox', context: CONTEXT });
  assert.equal(product.interpretedText, 'el estado de IBA y ChatBox');
});

test('sensitive commands are never auto-corrected: Janus asks first', () => {
  const r = interpretTranscript({ text: 'publica la configuración de Infinity Group', context: CONTEXT });
  assert.equal(r.sensitiveCommand, true);
  assert.equal(r.interpretedText, r.originalText);
  assert.equal(r.needsConfirmation, true);
  assert.equal(r.confirmationPrompt, '¿Quisiste decir «InfinitySeed Group» en lugar de «Infinity Group»?');
});

test('correct names, quoted text, URLs, e-mails and paths are left untouched', () => {
  for (const text of [
    'Janus y ChatBox de InfinitySeed funcionan',
    'el cliente escribió "Infinity Group" en el formulario',
    'mira https://example.com/infinity-group/llanos',
    'escribe a infinity.group@example.com',
    'abre docs/infinity group/notes.md',
  ]) {
    const r = interpretTranscript({ text, context: CONTEXT });
    assert.equal(r.interpretedText, text, text);
  }
});

test('fuzzy phonetic matches are suggestions only', () => {
  const r = interpretTranscript({ text: 'sube la web a Hostinjer después de Vercel' });
  const fuzzy = r.corrections.find((c) => c.canonical === 'Hostinger');
  assert.ok(fuzzy);
  assert.equal(fuzzy.basis, 'fuzzy');
  assert.equal(fuzzy.applied, false);
  assert.equal(r.interpretedText, r.originalText);
});

test('vocabulary prompt primes speech-to-text with canonical names', () => {
  const prompt = transcriptionVocabularyPrompt();
  for (const name of ['Janus', 'InfinitySeed Group', 'ChatBox', 'IBA']) assert.ok(prompt.includes(name), name);
});

test('suggestedText carries every plausible correction for one-tap human confirmation', () => {
  const r = interpretTranscript({ text: 'publica la configuración de Infinity Group', context: CONTEXT });
  assert.equal(r.interpretedText, 'publica la configuración de Infinity Group');
  assert.equal(r.suggestedText, 'publica la configuración de InfinitySeed Group');
});
