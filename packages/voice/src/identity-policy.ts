/**
 * Provider-neutral voice identity registry.
 * No audio, face images, voice embeddings or credentials are persisted here.
 * Minor profiles are disabled until verified guardian authorization.
 */
export type VoiceSubject = 'jean' | 'kendra';
export type VoiceProvider = 'local-qwen' | 'elevenlabs';
export interface VoiceIdentity {
  subject: VoiceSubject;
  voiceId: string;
  provider: VoiceProvider;
  providerVoiceId?: string;
  enabled: boolean;
  guardianApproval?: { verified: boolean; grantedAt: string; guardianRef: string };
}
export function canSynthesize(identity: VoiceIdentity): boolean {
  if (!identity.enabled || !identity.voiceId.trim()) return false;
  if (identity.subject === 'kendra' &&
      (!identity.guardianApproval?.verified ||
       !identity.guardianApproval.guardianRef.trim() ||
       !Number.isFinite(Date.parse(identity.guardianApproval.grantedAt)))) return false;
  return identity.provider !== 'elevenlabs' || Boolean(identity.providerVoiceId?.trim());
}
export function resolveVoice(identity: VoiceIdentity):
  { provider: VoiceProvider; voiceId: string } {
  if (!canSynthesize(identity)) throw new Error('voice_identity_not_authorized');
  return {
    provider: identity.provider,
    voiceId: identity.provider === 'elevenlabs' ? identity.providerVoiceId! : identity.voiceId
  };
}
