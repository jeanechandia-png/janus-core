import test from 'node:test';
import assert from 'node:assert/strict';
import { autoBootstrapNewChat, briefPreviousChats, previousChats, type ChatTranscript } from '../packages/core/src/chat-continuity.js';
import { auditClaim, classifySource, planLayeredResearch, rankSources, type Source } from '../packages/orchestrator/src/research-verification.js';

const T: ChatTranscript[] = [
  { chatId: 'c2', startedAt: '2026-10-21T09:00:00Z', messages: [
    { at: '2026-10-21T09:00:00Z', role: 'user', text: 'Implementa la vista de ofertas' },
    { at: '2026-10-21T09:05:00Z', role: 'assistant', text: 'Hecho.' },
    { at: '2026-10-21T09:10:00Z', role: 'user', text: 'Desaprobado, corrige el teléfono' },
    { at: '2026-10-21T09:20:00Z', role: 'user', text: 'Me gusta la A. Falta la sección de proyectos' },
    { at: '2026-10-21T09:30:00Z', role: 'user', text: '¿Cuánto cuesta el hosting?' } ] },
  { chatId: 'c1', startedAt: '2026-10-20T09:00:00Z', messages: [{ at: '2026-10-20T09:00:00Z', role: 'user', text: 'Hola' }] },
  { chatId: 'c3', startedAt: '2026-10-22T09:00:00Z', messages: [] }
];

test('al abrir un chat nuevo lee el anterior en orden cronológico', () => {
  assert.deepEqual(previousChats(T, 'c3').map((c) => c.chatId), ['c2']);
  assert.deepEqual(previousChats(T, 'c3', 2).map((c) => c.chatId), ['c1', 'c2']);
  const b = briefPreviousChats(T, 'c3');
  assert.equal(b.requests[0], 'Implementa la vista de ofertas');
  assert.match(b.corrections[0]!, /Desaprobado/);
  assert.match(b.decisions[0]!, /Me gusta la A/);
  assert.match(b.pending[0]!, /Falta/);
  assert.deepEqual(b.openQuestions, ['¿Cuánto cuesta el hosting?']);
  const { snapshot, briefing } = autoBootstrapNewChat([], T, 'c3');
  assert.equal(snapshot.latestSessionId, 'c2');
  assert.ok(snapshot.resumeFrom);
  assert.match(briefing.summary, /Preguntas sin responder/);
});

test('clasificación y ranking de fuentes: universidades primero', () => {
  assert.equal(classifySource({ url: 'https://news.stanford.edu/x' }).elite, true);
  assert.equal(classifySource({ url: 'https://www.nature.com/a' }).tier, 'A');
  assert.equal(classifySource({ url: 'https://www.rijksoverheid.nl/x' }).tier, 'A-');
  assert.equal(classifySource({ url: 'https://medium.com/x' }).tier, 'C');
  const r = rankSources([{ url: 'https://medium.com/x' }, { url: 'https://www.bbc.com/y' }, { url: 'https://hbs.harvard.edu/z' }]);
  assert.equal(r[0]!.url, 'https://hbs.harvard.edu/z');
});

test('auditoría: verificado solo con ≥2 dominios independientes y nivel A; detecta citas falsas', () => {
  const S: Source[] = [
    { url: 'https://news.stanford.edu/a', fetched: { ok: true, text: 'Praise for effort increases persistence in children.' } },
    { url: 'https://www.apa.org/b', fetched: { ok: true, text: 'Studies show praise for effort increases persistence.' } },
    { url: 'https://blog.example.com/c', fetched: { ok: true, text: 'something else' } },
    { url: 'https://www.nature.com/d', fetched: { ok: false, status: 404 } }
  ];
  const ok = auditClaim({ id: 'c1', text: 'x', evidence: [{ url: S[0]!.url, quote: 'praise for effort increases persistence' }, { url: S[1]!.url, quote: 'praise for effort increases persistence' }] }, S);
  assert.equal(ok.verdict, 'VERIFICADO');
  const fake = auditClaim({ id: 'c2', text: 'y', evidence: [{ url: S[2]!.url, quote: 'cita inventada' }, { url: S[3]!.url, quote: 'z' }] }, S);
  assert.equal(fake.verdict, 'DESCARTADO');
  assert.ok(fake.flags.some((f) => f.startsWith('cita no encontrada')));
  assert.ok(fake.flags.some((f) => f.startsWith('enlace caído')));
  const one = auditClaim({ id: 'c3', text: 'w', evidence: [{ url: S[0]!.url, quote: 'Praise for effort' }] }, S);
  assert.equal(one.verdict, 'PROBABLE');
});

test('plan por capas con auditor aislado', () => {
  const p = planLayeredResearch('¿Funciona el elogio del esfuerzo?', ['psicología', 'educación']);
  assert.equal(p.filter((l) => l.layer === 1).length, 2);
  assert.deepEqual(p.find((l) => l.layer === 3)!.isolatedFrom, [1]);
});

test('no confunde HTTP 200 con una cita verificada cuando falta el texto de la fuente', () => {
  const url = 'https://www.nih.gov/a';
  const claim = { id: 'c-no-text', text: 'Dato por verificar', evidence: [{ url, quote: 'dato supuestamente confirmado' }] };
  const absent = auditClaim(claim, [{ url, fetched: { ok: true, status: 200 } }]);
  assert.equal(absent.verdict, 'POR CONFIRMAR');
  assert.equal(absent.independentDomains, 0);
  assert.ok(absent.flags.some((x) => x.startsWith('sin texto comprobable')));
  const blank = auditClaim({ ...claim, evidence: [{ url, quote: '   ' }] }, [{ url, fetched: { ok: true, text: 'Un dato' } }]);
  assert.equal(blank.verdict, 'POR CONFIRMAR');
  assert.equal(blank.independentDomains, 0);
});

test('una fuente no descargada no es una segunda fuente independiente', () => {
  const sources: Source[] = [
    { url: 'https://web.stanford.edu/a', fetched: { ok: true, text: 'Un hallazgo comprobado.' } },
    { url: 'https://www.nih.gov/b' },
  ];
  const audit = auditClaim({ id: 'c-partial', text: 'Hallazgo', evidence: [
    { url: sources[0]!.url, quote: 'hallazgo comprobado' },
    { url: sources[1]!.url, quote: 'hallazgo comprobado' },
  ] }, sources);
  assert.equal(audit.verdict, 'PROBABLE');
  assert.equal(audit.independentDomains, 1);
});
