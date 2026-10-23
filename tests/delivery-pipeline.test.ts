import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryGate, FOUNDER_REQUIRED_DIMENSIONS } from '../packages/core/src/delivery-gate.js';
import { createFounderQualityReviewers } from '../packages/core/src/quality-reviewers.js';
import { DeliveryPipeline, PipelineError, checkPreview } from '../packages/core/src/delivery-pipeline.js';

const gate = () => new DeliveryGate(createFounderQualityReviewers(), { required: FOUNDER_REQUIRED_DIMENSIONS });
const good = { id: 'doc-1', kind: 'document' as const, content: '📘 Informe claro y ordenado.\n\nEste documento resume el estado del proyecto con calma y precisión.', metadata: { locale: 'es' } };
const PREVIEW = '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><nav><a href="#a">A</a><a href="#b">B</a></nav><section id="a">A</section><section id="b">B</section></body></html>';

test('i18n filter catches mojibake, untranslated markers, missing locale keys and placeholder drift', async () => {
  const g = gate();
  assert.ok((await g.evaluate({ ...good, content: 'InformaciÃ³n de contacto' })).blockingFindings.some((f) => f.code === 'i18n.mojibake'));
  assert.ok((await g.evaluate({ ...good, content: 'Hola [[TODO translate]] mundo' })).blockingFindings.some((f) => f.code === 'i18n.untranslated-marker'));
  assert.ok((await g.evaluate({ ...good, kind: 'ui', content: '<html><body>Hola</body></html>' })).blockingFindings.some((f) => f.code === 'i18n.missing-lang'));
  const catalogs = { es: { hi: 'Hola {name}', bye: 'Adiós' }, en: { hi: 'Hello' }, nl: { hi: 'Hallo {naam}', bye: 'Tot ziens' } };
  const codes = (await g.evaluate({ ...good, metadata: { catalogs, sourceLocale: 'es' } })).blockingFindings.map((f) => f.code);
  assert.ok(codes.includes('i18n.missing-key')); assert.ok(codes.includes('i18n.placeholder-mismatch'));
  assert.equal((await g.evaluate(good)).passed, true);
  assert.equal((await g.evaluate({ ...good, content: 'Ejemplo [[1,2],[3,4]] en una matriz sin marcadores.' })).passed, true);
});

test('style never blocks and offers warnings', async () => {
  const text = 'Hacemos esto. Hacemos aquello. Hacemos lo otro. ' + 'palabra '.repeat(200);
  const result = await gate().evaluate({ ...good, content: text });
  const style = result.reviews.find((r) => r.dimension === 'style')!;
  assert.equal(style.passed, true);
  assert.ok(style.findings.some((f) => f.code === 'style.repeated-openers'));
  assert.ok(style.findings.some((f) => f.code === 'style.low-lexical-variety'));
});

test('preview must be navigable and mobile-ready', () => {
  assert.equal(checkPreview(PREVIEW).ok, true);
  assert.equal(checkPreview('<html><body><img src="x.png"></body></html>').ok, false);
  assert.match(checkPreview('<html><body><nav><a href="#x">x</a></nav></body></html>').problems.join(' '), /viewport|static/);
  assert.equal(checkPreview('<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><embed type="application/pdf" src="a.pdf"></body></html>').ok, false);
});

test('pipeline order: two passes, navigable preview, Founder decision, only then package', async () => {
  const pipeline = new DeliveryPipeline(gate(), { founderPrincipalId: 'founder', now: () => new Date('2026-10-21T10:00:00Z') });
  let state = await pipeline.submit(good);
  assert.equal(state.stage, 'filters_passed');
  assert.throws(() => pipeline.attachPreview(state, { html: PREVIEW }), (e: unknown) => e instanceof PipelineError && e.code === 'pipeline.stage');
  state = await pipeline.recheck(state, good);
  assert.equal(state.stage, 'rechecked');
  assert.throws(() => pipeline.attachPreview(state, { html: '<html><body>estático</body></html>' }), /viewport|not-a-document|static/);
  state = pipeline.attachPreview(state, { html: PREVIEW });
  assert.equal(state.stage, 'preview_ready');
  const pkg = { format: 'zip', artifact: good, inlineText: good.content, directFile: true };
  assert.throws(() => pipeline.authorizePackage(state, pkg), (e: unknown) => e instanceof PipelineError && e.code === 'pipeline.stage');
  assert.throws(() => pipeline.decide(state, { approved: true, by: 'janus' }), (e: unknown) => e instanceof PipelineError && e.code === 'pipeline.not-founder');
  const rejected = pipeline.decide(state, { approved: false, by: 'founder', note: 'cambiar portada' });
  assert.equal(rejected.stage, 'changes_requested');
  state = pipeline.decide(state, { approved: true, by: 'founder' });
  assert.equal(state.stage, 'approved');
  assert.throws(() => pipeline.authorizePackage(state, { ...pkg, directFile: false }), /directly/);
  assert.throws(() => pipeline.authorizePackage(state, { ...pkg, inlineText: ' ' }), /inline/);
  assert.throws(() => pipeline.authorizePackage(state, { ...pkg, artifact: { ...good, content: good.content + ' cambio' } }), /differs/);
  state = pipeline.authorizePackage(state, pkg);
  assert.equal(state.stage, 'packaged');
  assert.deepEqual(state.history.map((h) => h.stage), ['filters_passed', 'rechecked', 'preview_ready', 'approved', 'packaged']);
});

test('failed filters and changed content stop the pipeline', async () => {
  const pipeline = new DeliveryPipeline(gate(), { founderPrincipalId: 'founder' });
  const bad = { ...good, content: 'Texto con TBD pendiente' };
  assert.equal((await pipeline.submit(bad)).stage, 'filters_failed');
  const ok = await pipeline.submit(good);
  await assert.rejects(pipeline.recheck(ok, { ...good, content: good.content + ' editado' }), /Content changed/);
});
