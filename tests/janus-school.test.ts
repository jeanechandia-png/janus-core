import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDER_LESSONS, GLOSSARY, NO_DIAGNOSIS_NOTICE, allEvidence, checkAnswer, completeLesson, dueCards, freshCard,
  gradeCard, listTechniques, lookupTerm, newProgress, nextLesson, planKidSession, renderTechnique, reviewCard,
} from '../packages/modules/janus-school/src/index.js';
import { JanusSchoolToolAdapter, MemorySchoolProgressStore } from '../packages/adapters/src/janus-school-tool-adapter.js';
import { deterministicPlan } from '../packages/orchestrator/src/deterministic-planner.js';
import { fuseIdentityHints } from '../packages/core/src/identity-fusion.js';
import { policyForSpeaker } from '../packages/core/src/speaker-policy.js';

const noop = async () => {};
const NOW = new Date('2026-10-21T10:00:00Z');

test('content is consistent: lessons reference real glossary terms and valid quiz answers', () => {
  const termIds = new Set(GLOSSARY.map((t) => t.id));
  assert.equal(termIds.size, GLOSSARY.length, 'glossary ids must be unique');
  assert.ok(GLOSSARY.length >= 60);
  const quizIds = new Set<string>();
  for (const lesson of FOUNDER_LESSONS) {
    assert.ok(lesson.checks.length >= 2);
    for (const id of lesson.termIds) assert.ok(termIds.has(id), `${lesson.id} -> unknown term ${id}`);
    for (const q of lesson.checks) {
      assert.ok(!quizIds.has(q.id)); quizIds.add(q.id);
      assert.ok(q.answer >= 0 && q.answer < q.options.length);
    }
  }
});

test('kids content never diagnoses and states weak evidence plainly', () => {
  const abacus = listTechniques().find((t) => t.id.startsWith('abaco'))!;
  assert.match(renderTechnique(abacus), /no mostr/);
  assert.ok(allEvidence().some((e) => e.id === 'abacus-rct' && e.level === 'research-mixed'));
  const plan = planKidSession({ minutes: 15, energy: 'high', ageBand: '8-10', seed: 's' });
  assert.match(plan.notes.join(' '), /no diagnostica/);
  assert.equal(plan.blocks[0]!.kind, 'move');
  assert.equal(plan.blocks.at(-1)!.kind, 'wrap');
  assert.ok(plan.blocks.filter((b) => b.kind === 'focus').every((b) => b.minutes <= 10));
  assert.ok(plan.totalMinutes <= 20);
  assert.match(planKidSession({}).notes[0]!, /edad/);
  assert.match(NO_DIAGNOSIS_NOTICE, /no diagnostica/);
});

test('spaced repetition schedules intervals and lapses', () => {
  let card = freshCard(NOW);
  card = reviewCard(card, 5, NOW); assert.equal(card.intervalDays, 1);
  card = reviewCard(card, 5, NOW); assert.equal(card.intervalDays, 6);
  card = reviewCard(card, 5, NOW); assert.ok(card.intervalDays > 6);
  const lapsed = reviewCard(card, 1, NOW);
  assert.equal(lapsed.repetitions, 0); assert.equal(lapsed.lapses, 1); assert.equal(lapsed.intervalDays, 1);
});

test('founder progress: complete a lesson creates cards that become due', () => {
  let progress = newProgress('founder', 'founder', NOW);
  const lesson = nextLesson(progress)!;
  progress = completeLesson(progress, lesson.id, NOW);
  assert.ok(Object.keys(progress.cards).length > 0);
  assert.ok(dueCards(progress, NOW).length > 0);
  const key = dueCards(progress, NOW)[0]!;
  progress = gradeCard(progress, key, 5, NOW);
  assert.ok(!dueCards(progress, NOW).includes(key));
  assert.equal(nextLesson(progress)!.id !== lesson.id, true);
  assert.equal(lookupTerm('qué es una API')[0]?.id, 'api');
  assert.equal(checkAnswer('f01-q1', 1)?.correct, true);
});

test('adapter: founder learns offline; a child profile cannot reach founder content', async () => {
  const adapter = new JanusSchoolToolAdapter(new MemorySchoolProgressStore(), () => NOW);
  const lesson = await adapter.execute({ tool: 'janus-school', action: 'lesson.next', input: {} }, noop);
  assert.equal(lesson.ok, true); assert.match(String(lesson.output?.reply), /Unidad 1/);
  await adapter.execute({ tool: 'janus-school', action: 'lesson.complete', input: { lessonId: lesson.output?.lessonId } }, noop);
  assert.match(String((await adapter.execute({ tool: 'janus-school', action: 'review.next', input: {} }, noop)).output?.reply), /¿Qué es/);
  const denied = await adapter.execute({ tool: 'janus-school', action: 'lesson.next', input: { learnerId: 'kendra' } }, noop);
  assert.equal(denied.ok, false);
  assert.equal((await adapter.execute({ tool: 'janus-school', action: 'kids.guide', input: { learnerId: 'kendra' } }, noop)).ok, false);
  const session = await adapter.execute({ tool: 'janus-school', action: 'kids.session', input: { learnerId: 'kendra', minutes: 12, energy: 'high', age: 8 } }, noop);
  assert.equal(session.ok, true); assert.match(String(session.output?.reply), /Sesión de/);
  assert.equal((await adapter.execute({ tool: 'janus-school', action: 'x.y', input: {} }, noop)).ok, false);
});

test('planner routes school requests to the read-only tool', () => {
  const kids = deterministicPlan('Prepara una sesión de matemáticas de 12 minutos para Kendra, está muy inquieta');
  assert.equal(kids?.steps[0]?.tool, 'janus-school'); assert.equal(kids?.steps[0]?.action, 'kids.session');
  assert.equal((kids?.steps[0]?.input as { energy: string }).energy, 'high');
  assert.equal(deterministicPlan('Enséñame las técnicas chinas del ábaco para mi hija')?.steps[0]?.action, 'kids.technique');
  assert.equal(deterministicPlan('Cómo ayudar a mi hija con TDAH en casa')?.steps[0]?.action, 'kids.guide');
  assert.equal((deterministicPlan('Quiero aprender Git y GitHub')?.steps[0]?.input as { lessonId: string }).lessonId, 'f02-git-y-github');
  assert.equal(deterministicPlan('Qué significa webhook')?.steps[0]?.action, 'glossary.lookup');
  assert.equal(deterministicPlan('Vamos a repasar')?.steps[0]?.action, 'review.next');
  assert.equal(deterministicPlan('Estoy muy estresado')?.steps[0]?.tool, 'seneca');
  assert.equal(deterministicPlan('Háblame de Marco Aurelio')?.steps[0]?.tool, 'marcus-aurelius');
  assert.equal(deterministicPlan('Janus School')?.steps[0]?.requiresApproval, false);
});

test('identity fusion: the most restricted matched profile wins; strict mode restricts non-owner hints', () => {
  assert.equal(fuseIdentityHints([undefined, undefined]), undefined);
  assert.deepEqual(fuseIdentityHints([{ decision: 'match', profile: 'owner' }, { decision: 'match', profile: 'minor' }]), { decision: 'match', profile: 'minor' });
  assert.deepEqual(fuseIdentityHints([{ decision: 'unknown' }, { decision: 'ambiguous' }]), { decision: 'ambiguous' });
  assert.deepEqual(fuseIdentityHints([{ decision: 'unknown' }]), { decision: 'unknown' });
  assert.equal(policyForSpeaker({ decision: 'unknown' }).restricted, false);
  assert.equal(policyForSpeaker({ decision: 'unknown' }, { strict: true }).restricted, true);
  assert.equal(policyForSpeaker({ decision: 'ambiguous' }, { strict: true }).restricted, true);
  assert.equal(policyForSpeaker({ decision: 'match', profile: 'owner' }, { strict: true }).restricted, false);
  assert.equal(policyForSpeaker(undefined, { strict: true }).restricted, false);
  assert.ok(policyForSpeaker({ decision: 'match', profile: 'minor' }).allowedTools.includes('janus-school'));
});
