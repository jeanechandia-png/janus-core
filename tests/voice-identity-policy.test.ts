import assert from 'node:assert/strict';
import test from 'node:test';
import { canSynthesize, resolveVoice } from '../packages/voice/src/identity-policy.ts';

test('Jean local identity resolves', () => {
  assert.deepEqual(resolveVoice({subject:'jean',voiceId:'jean-local',provider:'local-qwen',enabled:true}),
    {provider:'local-qwen',voiceId:'jean-local'});
});
test('Kendra requires verified guardian approval', () => {
  const base = {subject:'kendra' as const,voiceId:'kendra-local',provider:'local-qwen' as const,enabled:true};
  assert.equal(canSynthesize(base),false);
  assert.throws(()=>resolveVoice(base),/not_authorized/);
  assert.equal(canSynthesize({...base,guardianApproval:{verified:true,grantedAt:'2026-11-02T12:00:00Z',guardianRef:'guardian-local-record'}}),true);
});
test('ElevenLabs requires provider voice identifier',()=>{
  assert.equal(canSynthesize({subject:'jean',voiceId:'jean',provider:'elevenlabs',enabled:true}),false);
});
