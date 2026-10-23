import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QUOTES, dailyReflection, formatQuote, getProfile, listQuotes, mentionsCrisis, selectGuidance,
} from '../packages/modules/marcus-aurelius-wisdom/src/index.js';
import { MarcusAureliusToolAdapter } from '../packages/adapters/src/marcus-aurelius-tool-adapter.js';
import { deterministicPlan } from '../packages/orchestrator/src/deterministic-planner.js';

const noop = async () => {};

test('every quote has a status; verified ones carry the English wording and a locus', () => {
  assert.ok(QUOTES.length >= 10);
  const ids = new Set<string>();
  for (const quote of QUOTES) {
    assert.ok(!ids.has(quote.id), `duplicate id ${quote.id}`);
    ids.add(quote.id);
    if (quote.status === 'text-verified-long') {
      assert.ok(quote.en && quote.locus, `${quote.id} must keep its English source wording and locus`);
    } else {
      assert.equal(quote.en, undefined);
      assert.ok(quote.note, `${quote.id} must explain why it is not verified`);
    }
  }
});

test('an attributed quote is always labelled and never offered as literal', () => {
  const attributed = QUOTES.find((q) => q.status === 'attributed-unlocated')!;
  assert.match(formatQuote(attributed), /no la tomes como cita literal/);
  const guidance = selectGuidance('Siento que no controlo nada de lo que pasa', { seed: 1, maxQuotes: 3 });
  if (guidance.quotes.some((q) => q.status === 'attributed-unlocated')) {
    assert.match(guidance.reply, /no he localizado el pasaje/);
    assert.ok(guidance.quotes.some((q) => q.status === 'text-verified-long'), 'attributed quote must be anchored by a verified one');
  }
});

test('crisis language yields support-first guidance with no quotations', () => {
  assert.equal(mentionsCrisis('quiero morir'), true);
  const guidance = selectGuidance('ya no quiero vivir');
  assert.equal(guidance.mode, 'support_first');
  assert.equal(guidance.quotes.length, 0);
  assert.doesNotMatch(guidance.reply, /Marco Aurelio ·/);
});

test('guidance, profile and daily reflection are deterministic and disclose the translation basis', () => {
  const a = selectGuidance('Estoy estresado y con mucha ira', { seed: 'x' });
  const b = selectGuidance('Estoy estresado y con mucha ira', { seed: 'x' });
  assert.equal(a.reply, b.reply);
  assert.match(a.reply, /George Long/);
  for (const section of ['overview', 'life', 'works', 'doctrine', 'modern_psychology', 'limits'] as const) {
    assert.ok(getProfile(section).text.length > 40);
  }
  assert.equal(dailyReflection(new Date('2026-10-18T00:00:00Z')).quotes[0]?.status, 'text-verified-long');
  assert.ok(listQuotes({ theme: 'anger' }).length > 0);
});

test('Janus adapter serves Marcus Aurelius locally and rejects unknown actions', async () => {
  const adapter = new MarcusAureliusToolAdapter(() => new Date('2026-10-18T10:00:00Z'));
  const ok = await adapter.execute({ tool: 'marcus-aurelius', action: 'guidance.get', input: { text: 'estoy agobiado' } }, noop);
  assert.equal(ok.ok, true);
  assert.equal(typeof ok.output?.reply, 'string');
  const quote = await adapter.execute({ tool: 'marcus-aurelius', action: 'quote.get', input: {} }, noop);
  assert.equal((quote.output as { status: string }).status, 'text-verified-long');
  assert.equal((await adapter.execute({ tool: 'marcus-aurelius', action: 'mail.send', input: {} }, noop)).ok, false);
});

test('planner routes Marcus Aurelio to its tool, Seneca and generic stress keep the Seneca tool', () => {
  const marcus = deterministicPlan('Cuéntame la vida de Marco Aurelio');
  assert.equal(marcus?.steps[0]?.tool, 'marcus-aurelius');
  assert.equal(marcus?.steps[0]?.action, 'profile.get');
  assert.equal(marcus?.steps[0]?.requiresApproval, false);
  assert.equal(deterministicPlan('Dame una frase de Marco Aurelio')?.steps[0]?.action, 'quote.get');
  assert.equal(deterministicPlan('Estoy agobiado, ayúdame con Marco Aurelio')?.steps[0]?.tool, 'marcus-aurelius');
  assert.equal(deterministicPlan('Compara a Séneca y Marco Aurelio')?.steps[0]?.tool, 'seneca');
  assert.equal(deterministicPlan('Estoy muy estresado')?.steps[0]?.tool, 'seneca');
  assert.equal(deterministicPlan('Háblame del estoicismo')?.steps[0]?.tool, 'seneca');
});
