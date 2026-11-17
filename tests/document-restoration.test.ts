import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODIFIED_MARK,
  RESTORED_MARK,
  planRestoration,
  sealRestoration,
  verifyRestorationChain,
  type RestorationRequest,
} from '../packages/core/src/document-restoration.js';

const base: RestorationRequest = {
  jobId: 'job-1',
  environment: 'infinity-lab',
  product: 'janus',
  operatorId: 'founder',
  documentClass: 'business_internal',
  authorization: { authorizedBy: 'founder', jobId: 'job-1', authorizedAt: '2026-10-20T11:59:00.000Z' },
  original: { ref: 'lab://scans/brochure-2019.pdf', sha256: 'b'.repeat(64), mimeType: 'application/pdf' },
  operations: ['deskew', 'denoise', 'ocr_transcribe'],
  purpose: 'Recuperar el folleto 2019 dañado para reutilizar su texto',
};

test('runs only inside Infinity Lab', () => {
  assert.throws(() => planRestoration({ ...base, environment: 'production' }), /Infinity Lab/);
});

test('exclusive to Janus: no other product can use it', () => {
  for (const product of ['chatbox', 'iba', 'school', 'connect']) {
    assert.throws(() => planRestoration({ ...base, product }), /exclusive to Janus/);
  }
});

test('every job needs the Founder authorization for that exact job', () => {
  assert.throws(() => planRestoration({ ...base, authorization: { ...base.authorization, authorizedBy: 'someone' } }), /Founder authorization/);
  assert.throws(() => planRestoration({ ...base, authorization: { ...base.authorization, jobId: 'other-job' } }), /Founder authorization/);
});

test('physical restoration is allowed and marked as a restored copy', () => {
  const plan = planRestoration(base);
  assert.deepEqual(plan.refused, []);
  assert.equal(plan.mark, RESTORED_MARK);
});

test('with Founder authorization, content of non-official documents can be edited; the copy is marked as modified', () => {
  const plan = planRestoration({ ...base, operations: ['ocr_transcribe', 'edit_text'] });
  assert.ok(plan.allowed.includes('edit_text'));
  assert.equal(plan.mark, MODIFIED_MARK);
});

test('protected classes are restored, never altered', () => {
  for (const documentClass of ['identity', 'government_issued', 'financial_instrument', 'legal_certificate', 'academic_credential', 'medical_record'] as const) {
    const plan = planRestoration({ ...base, documentClass, operations: ['denoise', 'change_date', 'replace_photo'] });
    assert.deepEqual(plan.allowed, ['denoise']);
    assert.equal(plan.refused.length, 2);
    assert.equal(plan.mark, RESTORED_MARK);
  }
});

test('signatures and seals are never altered, even with Founder authorization', () => {
  const plan = planRestoration({ ...base, operations: ['alter_signature', 'alter_seal'] });
  assert.equal(plan.allowed.length, 0);
});

test('provenance manifests chain and detect tampering', () => {
  const plan = planRestoration(base);
  const first = sealRestoration({ request: base, plan, outputSha256: 'c'.repeat(64), createdAt: '2026-10-20T12:00:00.000Z' });
  assert.equal(first.authorizedBy, 'founder');
  const secondRequest = { ...base, jobId: 'job-2', authorization: { ...base.authorization, jobId: 'job-2' } };
  const second = sealRestoration({ request: secondRequest, plan: planRestoration(secondRequest), outputSha256: 'd'.repeat(64), previousAuditHash: first.auditHash, createdAt: '2026-10-20T12:05:00.000Z' });
  assert.equal(verifyRestorationChain([first, second]), true);
  assert.equal(verifyRestorationChain([{ ...first, contentModified: true }, second]), false);
  assert.throws(() => sealRestoration({ request: base, plan, outputSha256: base.original.sha256 }), /never overwritten/);
});
