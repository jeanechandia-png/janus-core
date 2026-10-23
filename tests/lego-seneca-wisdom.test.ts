import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BIOGRAPHY, DOCTRINE, EXERCISES, QUOTES, WORKS, dailyReflection, detectThemes, formatQuote, getProfile, getQuoteById,
  listQuotes, mentionsCrisis, selectGuidance,
} from '../packages/modules/seneca-wisdom/src/index.js';

test('every quote carries a verification status; verified ones have Latin and a locus', () => {
  assert.ok(QUOTES.length >= 10);
  for (const quote of QUOTES) {
    assert.ok(['verified-primary', 'locus-unverified', 'attributed-unlocated'].includes(quote.status), quote.id);
    if (quote.status !== 'attributed-unlocated') {
      assert.ok(quote.latin && quote.locus, `${quote.id} needs Latin and locus`);
    } else {
      assert.equal(quote.latin, undefined);
      assert.ok(quote.note, 'attributed quotes need an honesty note');
    }
  }
  assert.ok(listQuotes({ status: 'verified-primary' }).length >= 8);
});

test("the user's favourite line is kept, but flagged as attributed (not a verified literal quote)", () => {
  const quote = getQuoteById('attributed-two-burdens')!;
  assert.equal(quote.status, 'attributed-unlocated');
  assert.match(quote.es, /miedo a un mal futuro y el recuerdo de un mal pasado/);
  assert.match(formatQuote(quote), /atribuida a Séneca; no localicé el pasaje original/);
});

test('stress guidance cites sources, adds one exercise and states limits', () => {
  const guidance = selectGuidance('Estoy muy estresado y angustiado pensando en lo que pasará mañana', { seed: 'a' });
  assert.equal(guidance.mode, 'stoic');
  assert.ok(guidance.themes.includes('future_worry') && guidance.themes.includes('overwhelm'));
  assert.ok(guidance.quotes.length >= 1 && guidance.quotes.length <= 3);
  assert.ok(guidance.exercise);
  assert.match(guidance.reply, /Ejercicio de \d+ min/);
  assert.match(guidance.reply, /no sustituye a un profesional/);
  assert.ok(guidance.quotes.some((quote) => quote.status === 'verified-primary'));
});

test('worry about future AND past brings the favourite line together with a verified anchor and the honesty note', () => {
  const guidance = selectGuidance('No dejo de darle vueltas al pasado y me da miedo el futuro');
  assert.equal(guidance.quotes[0]!.id, 'attributed-two-burdens');
  assert.ok(guidance.quotes.some((quote) => quote.status === 'verified-primary'));
  assert.match(guidance.reply, /no localicé el pasaje original/);
  assert.match(guidance.disclaimers.join(' '), /no he localizado el pasaje/);
});

test('crisis language gets support-first guidance with no quotations or exercises', () => {
  for (const text of ['no quiero vivir más', 'a veces pienso en hacerme daño', 'I want to kill myself']) {
    assert.equal(mentionsCrisis(text), true, text);
    const guidance = selectGuidance(text);
    assert.equal(guidance.mode, 'support_first');
    assert.equal(guidance.quotes.length, 0);
    assert.equal(guidance.exercise, undefined);
    assert.match(guidance.reply, /servicios de emergencia/);
  }
  assert.equal(mentionsCrisis('estoy agobiado por el trabajo'), false);
});

test('daily reflection is deterministic per day and only uses verified passages', () => {
  const a = dailyReflection(new Date('2026-10-18T09:00:00Z'));
  const b = dailyReflection(new Date('2026-10-18T22:00:00Z'));
  const c = dailyReflection(new Date('2026-10-19T09:00:00Z'));
  assert.equal(a.reply, b.reply);
  assert.notEqual(a.reply, c.reply);
  assert.ok(a.quotes.every((quote) => quote.status === 'verified-primary'));
});

test('profile sections exist and keep facts honest (secondary-verified vs consensus)', () => {
  for (const section of ['overview', 'life', 'works', 'doctrine', 'modern_psychology', 'limits'] as const) {
    assert.ok(getProfile(section).text.length > 80, section);
  }
  assert.match(getProfile('life').text, /Córdoba/);
  assert.match(getProfile('life').text, /65 d\. C\./);
  assert.match(getProfile('modern_psychology').text, /no verificado|POR CONFIRMAR/);
  assert.ok(BIOGRAPHY.every((fact) => fact.basis === 'secondary-verified' || fact.basis === 'consensus-unverified'));
  assert.ok(WORKS.some((work) => work.latinTitle === 'Epistulae morales ad Lucilium'));
  assert.ok(DOCTRINE.every((point) => point.quoteIds.every((id) => getQuoteById(id))));
  assert.ok(EXERCISES.every((exercise) => exercise.steps.length >= 3 && exercise.modernAnalogue));
});

test('theme detection understands Spanish, English and Dutch cues', () => {
  assert.ok(detectThemes('tengo ansiedad por el futuro').includes('future_worry'));
  assert.ok(detectThemes('I feel overwhelmed and stressed').includes('overwhelm'));
  assert.ok(detectThemes('ik ben bezorgd').includes('future_worry'));
  assert.ok(detectThemes('quiero ser feliz').includes('happiness'));
});
