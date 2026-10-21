import assert from 'node:assert/strict';
import test from 'node:test';
import type { SpeechInputChunk, TranscriptEvent, VoiceGateway } from '../packages/gateways/src/contracts.js';
import { DuplexVoiceEngine, type DuplexVoiceEvent } from '../packages/voice/src/duplex-engine.js';
import { VoiceSessionController } from '../packages/voice/src/session.js';
import type { SpeakerResolver, VoiceSpeakerHint, VoiceRunContext } from '../packages/voice/src/speaker-hint.js';
import { policyForSpeaker, restrictBlueprintTools } from '../packages/core/src/speaker-policy.js';
import type { DecisionBlueprint } from '../packages/core/src/decision-blueprint.js';
import { SenecaToolAdapter } from '../packages/adapters/src/seneca-tool-adapter.js';
import { hintFromIdentification } from '../packages/adapters/src/speaker-recognition-adapter.js';
import { deterministicPlan } from '../packages/orchestrator/src/deterministic-planner.js';

const noop = async () => {};

test('speaker policy restricts only positively matched non-owner voices', () => {
  assert.equal(policyForSpeaker(undefined).restricted, false);
  assert.equal(policyForSpeaker({ decision: 'unknown' }).restricted, false);
  assert.equal(policyForSpeaker({ decision: 'ambiguous', profile: 'minor' }).restricted, false);
  assert.equal(policyForSpeaker({ decision: 'match', profile: 'owner' }).restricted, false);
  const minor = policyForSpeaker({ decision: 'match', profile: 'minor' });
  assert.equal(minor.restricted, true);
  assert.deepEqual([...minor.allowedTools], ['seneca', 'marcus-aurelius', 'janus-school']);
});

test('restrictBlueprintTools keeps only allowed tools and preserves identity', () => {
  const blueprint = {
    id: 'bp', revision: 3, tools: [
      { tool: 'github', actions: ['repo.get'] },
      { tool: 'seneca', actions: ['guidance.get'] },
      { tool: 'google-workspace', actions: ['gmail.messages.search'] },
    ],
  } as unknown as DecisionBlueprint;
  const restricted = restrictBlueprintTools(blueprint, ['seneca']);
  assert.deepEqual(restricted.tools.map((t) => t.tool), ['seneca']);
  assert.equal(restricted.id, 'bp');
  assert.equal(restricted.revision, 3);
  assert.equal(blueprint.tools.length, 3);
});

test('identification result maps to a convenience-only hint without embeddings', () => {
  const hint = hintFromIdentification({ decision: 'match', subjectId: 'kendra', role: 'household_minor', score: 0.8 } as never);
  assert.equal(hint.profile, 'minor');
  assert.equal(hint.assurance, 'convenience');
  const unknown = hintFromIdentification({ decision: 'unknown', score: 0.1 } as never);
  assert.equal(unknown.profile, undefined);
  assert.equal(unknown.subjectId, undefined);
});

test('Seneca adapter answers locally and rejects unknown actions', async () => {
  const adapter = new SenecaToolAdapter(() => new Date('2026-10-18T10:00:00Z'));
  const guidance = await adapter.execute({ tool: 'seneca', action: 'guidance.get', input: { text: 'Tengo mucho miedo a lo que pueda pasar mañana' } }, noop);
  assert.equal(guidance.ok, true);
  assert.equal(typeof guidance.output?.reply, 'string');
  const profile = await adapter.execute({ tool: 'seneca', action: 'profile.get', input: { section: 'life' } }, noop);
  assert.equal(profile.ok, true);
  const bad = await adapter.execute({ tool: 'seneca', action: 'mail.send', input: {} }, noop);
  assert.equal(bad.ok, false);
});

test('planner routes Seneca and stress requests to the read-only tool; others unaffected', () => {
  const life = deterministicPlan('Háblame de la vida de Séneca');
  assert.equal(life?.steps[0]?.tool, 'seneca');
  assert.equal(life?.steps[0]?.action, 'profile.get');
  assert.equal(life?.steps[0]?.requiresApproval, false);
  const stress = deterministicPlan('Estoy muy estresado y agobiado');
  assert.equal(stress?.steps[0]?.action, 'guidance.get');
  assert.equal(deterministicPlan('hola qué tal'), null);
});

test('voice engine forwards the speaker hint to the run and survives resolver failures', async () => {
  const hint: VoiceSpeakerHint = { decision: 'match', subjectId: 'kendra', profile: 'minor', score: 0.9, assurance: 'convenience' };
  const contexts: Array<VoiceRunContext | undefined> = [];
  const makeSession = () => new VoiceSessionController({
    sessionId: 's',
    runs: {
      start: async (_text, context) => { contexts.push(context); return 'run_1'; },
      pause: noop, resume: noop, cancel: noop,
    },
  });
  const gateway: VoiceGateway = {
    async *transcribeStream(chunks: AsyncIterable<SpeechInputChunk>): AsyncIterable<TranscriptEvent> {
      for await (const _c of chunks) yield { text: 'haz una investigación', final: true, language: 'es' };
    },
    async *synthesize() { yield { bytes: new Uint8Array([1]), mimeType: 'audio/pcm' }; },
  };
  const run = async (resolver: SpeakerResolver) => {
    const events: DuplexVoiceEvent[] = [];
    const engine = new DuplexVoiceEngine({ gateway, session: makeSession(), voiceId: 'v', onEvent: async (e) => { events.push(e); }, speakerResolver: resolver });
    engine.start();
    engine.pushAudio({ bytes: new Uint8Array([0, 0]), mimeType: 'audio/pcm;rate=16000;format=s16le', sequence: 1 });
    engine.endInput();
    await engine.waitForTranscription();
    return events;
  };

  const ok = await run({ push() {}, resolve: async () => hint });
  assert.deepEqual(contexts[0]?.speaker, hint);
  assert.ok(ok.some((e) => e.type === 'speaker.identified'));

  const failed = await run({ push() { throw new Error('boom'); }, resolve: async () => { throw new Error('model down'); } });
  assert.equal(contexts[1]?.speaker, undefined);
  assert.ok(failed.some((e) => e.type === 'voice.error' && e.stage === 'speaker_recognition'));
  assert.ok(failed.some((e) => e.type === 'session.action'));
});
