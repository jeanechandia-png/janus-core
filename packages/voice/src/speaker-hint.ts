/**
 * Provider-independent contract between the voice pipeline and any speaker-recognition piece.
 * Janus core knows nothing about how a speaker is recognised (no LEGO module is imported here):
 * an adapter supplies a SpeakerResolver, and the result is only a CONVENIENCE hint — never an
 * authentication factor and never an authority permit.
 */
export type SpeakerProfile = 'owner' | 'household_adult' | 'minor';

export interface VoiceSpeakerHint {
  decision: 'match' | 'ambiguous' | 'unknown' | 'insufficient_audio';
  /** Present only for a positive match. */
  subjectId?: string;
  profile?: SpeakerProfile;
  score: number;
  assurance: 'convenience';
}

export interface SpeakerResolver {
  /** Called with every inbound audio chunk (the resolver owns any buffering). */
  push(chunk: { bytes: Uint8Array; mimeType: string }): void;
  /** Called once per final transcript; returns the hint for the audio since the previous call. */
  resolve(): Promise<VoiceSpeakerHint | undefined>;
}

export interface VoiceRunContext {
  speaker?: VoiceSpeakerHint;
}
