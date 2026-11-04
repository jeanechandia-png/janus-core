import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessFounderVoiceClone, declaredVoiceCloneStatus, type VoiceCloneRecord,
} from '../packages/voice/src/voice-clone-lifecycle.js';

const accepted: VoiceCloneRecord = {
  subject: 'founder', persona: 'janus', provider: 'elevenlabs',
  stage: 'verified', providerVoiceId: 'AbCdEf1234567890',
  consentAt: '2026-11-04T16:00:00Z',
  verification: { acceptedByFounder: true, testedAt: '2026-11-04T17:00:00Z',
    testEvidenceRef: 'private-receipt:verified-01', verifiedOwnership: true, qualityAccepted: true },
};

test('default Janus cloned voice remains PENDING regardless of provider access', () => {
  const empty = assessFounderVoiceClone();
  assert.equal(empty.status, 'pending');
  assert.equal(empty.readyForUse, false);
  assert.equal(empty.synthesizedVoiceConfirmed, false);
  assert.equal(declaredVoiceCloneStatus({ JANUS_TTS_PROVIDER: 'elevenlabs', JANUS_ELEVENLABS_VOICE_ID: 'AbCdEf1234567890' }).cloneVerified, false);
  assert.equal(declaredVoiceCloneStatus({}).status, 'pending');
});

test('voice ID alone never proves a clone was created or approved', () => {
  const ready = assessFounderVoiceClone({ ...accepted, verification: undefined });
  assert.equal(ready.readyForUse, false);
  assert.match(ready.blockers.join(' '), /prueba real/i);
  const notTested = assessFounderVoiceClone({ ...accepted, stage: 'needs-verification' });
  assert.equal(notTested.readyForUse, false);
  assert.equal(assessFounderVoiceClone(accepted).readyForUse, true);
});

test('revocation always blocks use even if a voice is present', () => {
  const result = assessFounderVoiceClone({ ...accepted, stage: 'revoked', consentRevokedAt: '2026-11-05T00:00:00Z' });
  assert.equal(result.readyForUse, false);
  assert.match(result.blockers.join(' '), /revocado/i);
});

test('JANUS persona is not the Founder identity; local cloning requires original corpus', () => {
  const noCorpus = assessFounderVoiceClone({ ...accepted, provider: 'janus-local' });
  assert.equal(noCorpus.readyForUse, false);
  assert.match(noCorpus.blockers.join(' '), /corpus/i);
  const local = assessFounderVoiceClone({
    ...accepted, provider: 'janus-local', providerVoiceId: undefined,
    corpus: { subject: 'jean',
      consent: { grantedAt: '2026-11-04T10:00:00Z', grantedBy: 'subject', scope: 'JANUS internal voice' },
      samples: [{ id: 'original-01', provenance: 'original-recording', durationSeconds: 75,
        sha256: 'a'.repeat(64), storedLocally: true, hasTranscript: true, cleanAudioConfirmed: true }] },
  });
  assert.equal(local.readyForUse, true);
});
