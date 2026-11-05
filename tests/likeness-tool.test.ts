import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  MINOR_MAX_CONSENT_DAYS, createGuardianLikenessConsent, createLikenessConsent, decideLikenessUse, sha256,
} from '../packages/core/src/likeness-consent.js';
import { HOUSEHOLD_SAFE_TOOLS, policyForSpeaker } from '../packages/core/src/speaker-policy.js';
import { cloneScript, transcriptMatch } from '../packages/voice/src/voice-clone-scripts.js';
import { parseWav } from '../packages/voice/src/voice-clone-enrollment.js';
import {
  JsonFileLikenessStore, JsonFileVoiceConfigStore, LikenessToolAdapter, MemoryLikenessStore, MemoryVoiceConfigStore,
  type LikenessAdapterOptions,
} from '../packages/adapters/src/likeness-tool-adapter.js';
import { deterministicPlan } from '../packages/orchestrator/src/deterministic-planner.js';
import { enforceSensitiveActionPolicy } from '../packages/orchestrator/src/sensitive-action-policy.js';

const noop = async () => {};
const NOW = new Date('2026-10-23T14:00:00.000Z');

function wav(seconds: number, sampleRate = 24_000): Buffer {
  const samples = Math.round(seconds * sampleRate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 6000), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii'); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii'); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii'); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** A fake «converter» keeps these tests independent from ffmpeg; one real-ffmpeg test below covers the m4a path. */
const copyConvert = async (input: string, output: string) => { mkdirSync(dirname(output), { recursive: true }); copyFileSync(input, output); };

function setup(overrides: Partial<LikenessAdapterOptions> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'janus-likeness-'));
  const inboxDir = join(root, 'inbox');
  const privateDir = join(root, 'private');
  mkdirSync(inboxDir, { recursive: true });
  const consents = new MemoryLikenessStore();
  const voices = new MemoryVoiceConfigStore();
  const options: LikenessAdapterOptions = {
    consents, voices, inboxDir, privateDir, cloneModelPath: '/models/Qwen3-TTS-Base', now: () => NOW, convert: copyConvert, ...overrides,
  };
  const adapter = new LikenessToolAdapter(options);
  const run = (action: string, input: Record<string, unknown> = {}) => adapter.execute({ tool: 'likeness', action, input }, noop);
  return { root, inboxDir, privateDir, consents, voices, adapter, run, options, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ---------- core: consent for a minor ----------
const minorBase = {
  id: 'c1', principalId: 'kendra', guardianId: 'founder', guardianRelation: 'parent' as const, childAssent: true,
  uses: ['janus_private_assistant' as const], grantedAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 90 * 86_400_000).toISOString(),
  references: [{ modality: 'voice' as const, localRef: '/private/kendra/reference.wav', sha256: 'a'.repeat(64), transcript: 'Hola', capturedAt: NOW.toISOString() }],
};

test('a minor cannot consent for herself; the guardian must, with the child\'s assent, voice only, private uses, short-lived', () => {
  const ok = createGuardianLikenessConsent(minorBase);
  assert.equal(ok.subjectIsMinor, true);
  assert.equal(ok.grantedBy, 'founder');
  assert.deepEqual(ok.modalities, ['voice']);
  assert.deepEqual(ok.products, ['janus']);
  assert.throws(() => createGuardianLikenessConsent({ ...minorBase, guardianId: 'kendra' }), /distinct parent or guardian/);
  assert.throws(() => createGuardianLikenessConsent({ ...minorBase, childAssent: false }), /assent/);
  assert.throws(() => createGuardianLikenessConsent({ ...minorBase, uses: ['marketing_content'] }), /not permitted for a minor/);
  assert.throws(() => createGuardianLikenessConsent({ ...minorBase, uses: ['customer_voice_agent'] }), /not permitted for a minor/);
  assert.throws(() => createGuardianLikenessConsent({ ...minorBase, expiresAt: new Date(NOW.getTime() + (MINOR_MAX_CONSENT_DAYS + 1) * 86_400_000).toISOString() }), /at most/);
  assert.throws(() => createGuardianLikenessConsent({ ...minorBase, references: [{ ...minorBase.references[0]!, modality: 'face', transcript: undefined }] }), /voice references only/);
  assert.throws(() => createLikenessConsent({ ...ok, auditHash: undefined, disclosureRequired: undefined } as never), /createGuardianLikenessConsent/);
});

test('use decisions for a minor stay narrow even if a record were tampered with', () => {
  const ok = createGuardianLikenessConsent(minorBase);
  const request = { principalId: 'kendra', modality: 'voice' as const, use: 'janus_private_assistant' as const, product: 'janus', now: '2026-11-01T00:00:00.000Z' };
  assert.equal(decideLikenessUse([ok], request).allowed, true);
  assert.equal(decideLikenessUse([ok], { ...request, use: 'marketing_content' }).allowed, false);
  const tampered = { ...ok, uses: ['janus_private_assistant', 'marketing_content'] as typeof ok.uses, products: ['janus', 'chatbox'] };
  assert.equal(decideLikenessUse([tampered], { ...request, use: 'marketing_content' }).allowed, false, 'defense in depth');
  assert.equal(decideLikenessUse([tampered], { ...request, product: 'chatbox' }).allowed, false);
});

// ---------- scripts and transcript check ----------
test('reading scripts are long enough for the quality gate and the transcript check tolerates STT noise but not another text', () => {
  const founder = cloneScript('founder');
  const kendra = cloneScript('kendra');
  assert.ok(founder.approxSeconds >= 30 && founder.approxSeconds <= 90, `founder ${founder.approxSeconds}s`);
  assert.ok(kendra.approxSeconds >= 10 && kendra.approxSeconds <= 40, `kendra ${kendra.approxSeconds}s`);
  assert.equal(transcriptMatch(founder.text, founder.text.toUpperCase().replace(/[,.¿?¡!]/g, '')).wordErrorRate, 0);
  const oneWrong = founder.text.replace('natural', 'artificial');
  assert.ok(transcriptMatch(founder.text, oneWrong).ok);
  assert.equal(transcriptMatch(founder.text, 'Hoy hablaré de otra cosa muy distinta del texto').ok, false);
  assert.equal(transcriptMatch('', 'algo').ok, false);
});

// ---------- adapter: founder ----------
test('founder: a good take is converted, consented, registered for the local engine, and nothing private leaks into the output', async () => {
  const t = setup();
  try {
    writeFileSync(join(t.inboxDir, 'mi-voz.wav'), wav(40));
    const result = await t.run('founder.voice.enroll', { file: 'mi-voz.wav' });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.output?.stage, 'enrolled');
    const entry = t.voices.voices.get('jean-clone-es') as Record<string, unknown>;
    assert.equal(entry.mode, 'voice_clone');
    assert.equal(entry.consent_id, result.output?.consentId);
    assert.deepEqual(entry.allowed_uses, ['janus_private_assistant', 'internal_lab_test']);
    assert.equal(t.consents.list().length, 1);
    assert.equal(t.consents.list()[0]!.disclosureRequired, true);
    assert.ok(existsSync(join(t.privateDir, 'founder', 'reference.wav')));
    assert.equal(JSON.stringify(result).includes(t.privateDir), false, 'no private path in outputs');
    assert.match(String(result.output?.reply), /generada con IA/);
    assert.match(String(result.output?.reply), /no identifica ni autoriza/);
    // Idempotent: asking again without a new take does not duplicate anything.
    const again = await t.run('founder.voice.enroll', {});
    assert.equal(again.ok, true);
    assert.equal(t.consents.list().length, 1);
  } finally { t.cleanup(); }
});

test('founder: without the voice host the recording is kept and authorised, and enrolment completes later without recording again', async () => {
  const t = setup({ cloneModelPath: undefined });
  try {
    writeFileSync(join(t.inboxDir, 'mi-voz.wav'), wav(40));
    const first = await t.run('founder.voice.enroll', { file: 'mi-voz.wav' });
    assert.equal(first.ok, true, first.error);
    assert.equal(first.output?.stage, 'recorded_waiting_for_host');
    assert.equal(t.voices.voices.size, 0, 'nothing is written for the engine yet');
    assert.match(String((await t.run('status')).output?.reply), /falta el equipo con el modelo de voz/);
    const later = new LikenessToolAdapter({ ...t.options, cloneModelPath: '/models/Qwen3-TTS-Base' });
    const done = await later.execute({ tool: 'likeness', action: 'founder.voice.enroll', input: {} }, noop);
    assert.equal(done.ok, true, done.error);
    assert.equal(done.output?.stage, 'enrolled');
    assert.equal(t.consents.list().length, 1, 'same consent, no second recording');
  } finally { t.cleanup(); }
});

test('founder: bad takes are rejected and leave no reference behind (too short, low sample rate, STT mismatch); a matching STT check is recorded', async () => {
  const t = setup();
  try {
    writeFileSync(join(t.inboxDir, 'corta.wav'), wav(3));
    const short = await t.run('founder.voice.enroll', { file: 'corta.wav' });
    assert.equal(short.ok, false);
    assert.match(String(short.error), /too short/);
    assert.equal(existsSync(join(t.privateDir, 'founder', 'reference.wav')), false);
    writeFileSync(join(t.inboxDir, 'baja.wav'), wav(40, 8_000));
    assert.match(String((await t.run('founder.voice.enroll', { file: 'baja.wav' })).error), /sample rate/);
    assert.equal(t.consents.list().length, 0);

    writeFileSync(join(t.inboxDir, 'buena.wav'), wav(40));
    const wrong = setup({ transcribe: async () => 'Esto es otra frase que no tiene nada que ver con el texto indicado' });
    writeFileSync(join(wrong.inboxDir, 'buena.wav'), wav(40));
    const mismatch = await wrong.run('founder.voice.enroll', { file: 'buena.wav' });
    assert.equal(mismatch.ok, false);
    assert.match(String(mismatch.error), /no coincide con el texto/);
    assert.equal(existsSync(join(wrong.privateDir, 'founder', 'reference.wav')), false);
    wrong.cleanup();

    const right = setup({ transcribe: async () => cloneScript('founder').text });
    writeFileSync(join(right.inboxDir, 'buena.wav'), wav(40));
    const verified = await right.run('founder.voice.enroll', { file: 'buena.wav' });
    assert.equal(verified.ok, true, verified.error);
    assert.equal(verified.output?.transcriptVerified, true);
    right.cleanup();
  } finally { t.cleanup(); }
});

test('only recordings inside the inbox are read: traversal, absolute paths, symlinks and other file types are refused', async () => {
  const t = setup();
  try {
    writeFileSync(join(t.root, 'fuera.wav'), wav(40));
    writeFileSync(join(t.inboxDir, 'notas.txt'), 'hola');
    symlinkSync(join(t.root, 'fuera.wav'), join(t.inboxDir, 'enlace.wav'));
    for (const file of ['../fuera.wav', join(t.root, 'fuera.wav'), 'enlace.wav', 'notas.txt', 'no-existe.m4a']) {
      const result = await t.run('founder.voice.enroll', { file });
      assert.equal(result.ok, false, `${file} must be refused`);
    }
    assert.equal(t.consents.list().length, 0);
    assert.equal(t.voices.voices.size, 0);
  } finally { t.cleanup(); }
});

test('revocation withdraws the authorisation, the engine entry and the private copy', async () => {
  const t = setup();
  try {
    writeFileSync(join(t.inboxDir, 'mi-voz.wav'), wav(40));
    await t.run('founder.voice.enroll', { file: 'mi-voz.wav' });
    const revoked = await t.run('voice.revoke', { subject: 'founder' });
    assert.equal(revoked.ok, true);
    assert.equal(t.voices.voices.size, 0);
    assert.equal(existsSync(join(t.privateDir, 'founder', 'reference.wav')), false);
    assert.equal(t.consents.list().every((consent) => Boolean(consent.revokedAt)), true);
    assert.equal(decideLikenessUse(t.consents.list(), { principalId: 'founder', modality: 'voice', use: 'janus_private_assistant', product: 'janus', now: NOW.toISOString() }).allowed, false);
    assert.equal(readdirSync(t.inboxDir).includes('mi-voz.wav'), true, 'the person\'s own original is not touched');
  } finally { t.cleanup(); }
});

test('which recording is used: named in the sentence, or the lone file for the Founder; Kendra\'s must always be named', async () => {
  const t = setup();
  try {
    writeFileSync(join(t.inboxDir, 'Nota de voz.wav'), wav(40));
    // The lone file is used for the Founder without naming it.
    assert.equal((await t.run('founder.voice.enroll', { hint: 'usa mi grabacion' })).ok, true);
    await t.run('voice.revoke', { subject: 'founder' });
    // A sentence that names the file picks it among several.
    writeFileSync(join(t.inboxDir, 'otra.wav'), wav(40));
    assert.equal((await t.run('founder.voice.enroll', { hint: 'usa mi grabación nota de voz' })).ok, true);
    await t.run('voice.revoke', { subject: 'founder' });
    // Ambiguous: two files, nothing named.
    const ambiguous = await t.run('founder.voice.enroll', { hint: 'usa mi grabacion' });
    assert.equal(ambiguous.ok, false);
    assert.equal(t.voices.voices.size, 0);
    // Kendra: a lone, unnamed file is never assumed to be hers.
    rmSync(join(t.inboxDir, 'otra.wav'));
    const lone = await t.run('kendra.voice.enroll', { hint: 'usa la grabacion de kendra', guardianConfirms: true, childAssent: true });
    assert.equal(lone.ok, false);
    assert.equal(t.consents.list().filter((c) => c.principalId === 'kendra').length, 0);
    writeFileSync(join(t.inboxDir, 'kendra.wav'), wav(20));
    assert.equal((await t.run('kendra.voice.enroll', { hint: 'usa la grabacion de kendra', guardianConfirms: true, childAssent: true })).ok, true);
  } finally { t.cleanup(); }
});

// ---------- adapter: Kendra (standby) ----------
test('Kendra is on STANDBY: nothing is created until the guardian declares authority and the child\'s assent', async () => {
  const t = setup();
  try {
    assert.equal((await t.run('status')).output?.kendra, 'standby');
    assert.match(String((await t.run('kendra.voice.guide')).output?.reply), /EN ESPERA/);
    writeFileSync(join(t.inboxDir, 'kendra.wav'), wav(20));
    for (const input of [{ file: 'kendra.wav' }, { file: 'kendra.wav', guardianConfirms: true }, { file: 'kendra.wav', childAssent: true }]) {
      const result = await t.run('kendra.voice.enroll', input);
      assert.equal(result.ok, false);
      assert.match(String(result.error), /EN ESPERA/);
    }
    assert.equal(t.consents.list().length, 0);
    assert.equal(t.voices.voices.size, 0);
    assert.equal(existsSync(join(t.privateDir, 'kendra')), false);
    assert.equal((await t.run('status')).output?.kendra, 'standby');
  } finally { t.cleanup(); }
});

test('Kendra enrolment with both declarations creates a narrow guardian consent and a restricted engine entry; revoking returns her to a clean state', async () => {
  const t = setup();
  try {
    writeFileSync(join(t.inboxDir, 'kendra.wav'), wav(20));
    const result = await t.run('kendra.voice.enroll', { file: 'kendra.wav', guardianConfirms: true, childAssent: true });
    assert.equal(result.ok, true, result.error);
    const [consent] = t.consents.list();
    assert.equal(consent!.subjectIsMinor, true);
    assert.equal(consent!.grantedBy, 'founder');
    assert.equal(consent!.childAssent, true);
    assert.deepEqual(consent!.modalities, ['voice']);
    assert.deepEqual(consent!.uses, ['janus_private_assistant']);
    assert.ok(Date.parse(consent!.expiresAt) - Date.parse(consent!.grantedAt) <= MINOR_MAX_CONSENT_DAYS * 86_400_000);
    const entry = t.voices.voices.get('kendra-clone-es') as Record<string, unknown>;
    assert.equal(entry.restricted, true);
    assert.equal(entry.subject_is_minor, true);
    assert.deepEqual(entry.allowed_uses, ['janus_private_assistant']);
    const asks = (use: Parameters<typeof decideLikenessUse>[1]['use']) => decideLikenessUse(t.consents.list(), { principalId: 'kendra', modality: 'voice', use, product: 'janus', now: NOW.toISOString() }).allowed;
    assert.equal(asks('janus_private_assistant'), true);
    assert.equal(asks('marketing_content'), false);
    assert.equal(asks('customer_voice_agent'), false);
    assert.equal(asks('product_demo'), false);
    assert.equal((await t.run('voice.revoke', { subject: 'kendra' })).ok, true);
    assert.equal((await t.run('status')).output?.kendra, 'revoked');
    assert.equal(t.voices.voices.size, 0);
    assert.equal(existsSync(join(t.privateDir, 'kendra', 'reference.wav')), false);
    assert.equal(asks('janus_private_assistant'), false);
  } finally { t.cleanup(); }
});

// ---------- real files: persistence and the iPhone m4a path ----------
test('stores persist to disk with private permissions and keep other voices in voices.local.json', () => {
  const root = mkdtempSync(join(tmpdir(), 'janus-likeness-store-'));
  try {
    const voicesPath = join(root, 'voices.local.json');
    writeFileSync(voicesPath, JSON.stringify({ voices: { 'janus-default': { mode: 'custom_voice' } } }));
    const voices = new JsonFileVoiceConfigStore(voicesPath);
    voices.upsert('jean-clone-es', { mode: 'voice_clone', model_path: '/m', language: 'Spanish', ref_audio: '/r.wav', ref_text: 'x', x_vector_only_mode: false, ref_sha256: sha256('x'), consent_id: 'c' });
    assert.equal(voices.has('jean-clone-es'), true);
    voices.remove('jean-clone-es');
    const after = JSON.parse(readFileSync(voicesPath, 'utf8')) as { voices: Record<string, unknown> };
    assert.deepEqual(Object.keys(after.voices), ['janus-default']);
    const store = new JsonFileLikenessStore(join(root, 'consents.json'));
    store.save(createGuardianLikenessConsent(minorBase));
    assert.equal(new JsonFileLikenessStore(join(root, 'consents.json')).list().length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function hasFfmpeg(): boolean { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } }

test('an iPhone-style .m4a take is converted by the real ffmpeg into a mono 16-bit WAV and enrolled', { skip: !hasFfmpeg() && 'ffmpeg not installed' }, async () => {
  const t = setup({ convert: undefined });
  try {
    execFileSync('ffmpeg', ['-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=40', '-c:a', 'aac', join(t.inboxDir, 'Nota de voz.m4a')], { stdio: 'ignore' });
    const result = await t.run('founder.voice.enroll', { file: 'Nota de voz.m4a' });
    assert.equal(result.ok, true, result.error);
    const info = parseWav(readFileSync(join(t.privateDir, 'founder', 'reference.wav')));
    assert.equal(info.sampleRate, 24_000);
    assert.equal(info.channels, 1);
    assert.equal(info.bitsPerSample, 16);
    assert.ok(info.durationSeconds > 38 && info.durationSeconds < 42);
  } finally { t.cleanup(); }
});

// ---------- planner, policy and household safety ----------
test('the planner routes clone requests to `likeness`, never to the school, and never invents Kendra\'s declarations', () => {
  const step = (command: string) => deterministicPlan(command)?.steps[0];
  assert.equal(step('Hola Janus, vamos a clonar la voz de Kendra')?.tool, 'likeness');
  assert.equal(step('Hola Janus, vamos a clonar la voz de Kendra')?.action, 'kendra.voice.guide');
  assert.equal(step('Quiero clonar mi voz')?.action, 'founder.voice.guide');
  assert.equal(step('Quiero clonar mi voz')?.requiresApproval, false);
  const enroll = step('Janus, usa mi grabación Nota de voz.m4a');
  assert.equal(enroll?.action, 'founder.voice.enroll');
  assert.equal(enroll?.requiresApproval, true);
  assert.equal((enroll?.input as { file?: string }).file, undefined, 'free text is a hint, never a guessed file name');
  assert.match(String((enroll?.input as { hint?: string }).hint), /Nota de voz\.m4a/);
  assert.equal((step('Janus, usa mi grabación «Nueva grabación 3.m4a»')?.input as { file?: string }).file, 'Nueva grabación 3.m4a');
  const bare = step('Usa la grabación de Kendra');
  assert.equal(bare?.action, 'kendra.voice.enroll');
  assert.deepEqual({ g: (bare?.input as Record<string, unknown>).guardianConfirms, c: (bare?.input as Record<string, unknown>).childAssent }, { g: false, c: false });
  const declared = step('Usa la grabación de Kendra, ella está de acuerdo y yo la autorizo como su padre');
  assert.deepEqual({ g: (declared?.input as Record<string, unknown>).guardianConfirms, c: (declared?.input as Record<string, unknown>).childAssent }, { g: true, c: true });
  assert.equal((step('Kendra no quiere, usa la grabación de Kendra, yo la autorizo como su padre')?.input as Record<string, unknown>).childAssent, false);
  assert.equal(step('Revoca la voz clonada de Kendra')?.action, 'voice.revoke');
  assert.equal((step('Revoca la voz clonada de Kendra')?.input as { subject: string }).subject, 'kendra');
  assert.equal(step('Quiero que Janus reconozca mi cara, reconocimiento facial')?.action, 'founder.face.guide');
  assert.equal(step('Cómo va la clonación de mi voz, estado')?.action, 'status');
  // No regressions on neighbouring routes.
  assert.equal(step('Prepara una sesión de matemáticas de 12 minutos para Kendra')?.tool, 'janus-school');
  assert.equal(step('Quiero aprender Git y GitHub')?.tool, 'janus-school');
  assert.equal(step('Estoy muy estresado')?.tool, 'seneca');
});

test('enrolments are sensitive actions; a planner can never downgrade them', () => {
  const plan = deterministicPlan('Janus, usa mi grabación mi-voz.wav')!;
  const downgraded = { ...plan, steps: plan.steps.map((s) => ({ ...s, requiresApproval: false, risk: 'none' as const })) };
  const { plan: guarded, enforced } = enforceSensitiveActionPolicy(downgraded);
  assert.equal(enforced.length, 1);
  assert.equal(guarded.steps[0]!.requiresApproval, true);
  assert.equal(guarded.steps[0]!.risk, 'high');
  const kendraPlan = deterministicPlan('Usa la grabación de Kendra')!;
  assert.equal(enforceSensitiveActionPolicy({ ...kendraPlan, steps: kendraPlan.steps.map((s) => ({ ...s, requiresApproval: false })) }).enforced.length, 1);
});

test('a child or unknown-restricted profile can never reach the likeness tool', () => {
  assert.equal(HOUSEHOLD_SAFE_TOOLS.includes('likeness'), false);
  assert.equal(policyForSpeaker({ decision: 'match', profile: 'minor' }).allowedTools.includes('likeness'), false);
  assert.equal(policyForSpeaker({ decision: 'unknown' }, { strict: true }).allowedTools.includes('likeness'), false);
});
