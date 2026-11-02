/** Provider-independent biometric identity contracts. Never persist raw samples here. */
export type IdentitySubject = "jean" | "kendra";
export type IdentityModality = "voice" | "face";
export type IdentityPurpose = "recognition" | "voice-synthesis";
export interface IdentityConsent {
  subject: IdentitySubject;
  purpose: IdentityPurpose;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}
export interface IdentityProof {
  subject: IdentitySubject;
  modality: IdentityModality;
  confidence: number;
  verifiedAt: string;
  provider: string;
  /** Verification only; never confers authorization to execute privileged tools. */
  authorized: false;
}
export interface VoiceCloneRequest {
  subject: IdentitySubject;
  text: string;
  consent: IdentityConsent;
}
export interface VoiceCloneAdapter {
  readonly id: string;
  synthesize(request: VoiceCloneRequest): Promise<Uint8Array>;
}
export interface FaceRecognitionAdapter {
  readonly id: string;
  recognize(frame: Uint8Array): Promise<{ subject: IdentitySubject; confidence: number } | null>;
}
export interface VoiceRecognitionAdapter {
  readonly id: string;
  recognize(audio: Uint8Array): Promise<{ subject: IdentitySubject; confidence: number } | null>;
}
export function assertConsent(consent: IdentityConsent, subject: IdentitySubject, purpose: IdentityPurpose, now = new Date()): void {
  if (consent.subject !== subject || consent.purpose !== purpose || !consent.grantedBy.trim() ||
      !Number.isFinite(Date.parse(consent.grantedAt)) || Date.parse(consent.grantedAt) > now.getTime() ||
      consent.revokedAt || (consent.expiresAt && Date.parse(consent.expiresAt) <= now.getTime())) {
    throw new Error("identity.consent.required");
  }
}
export class IdentityLego {
  constructor(
    private readonly voiceClone: VoiceCloneAdapter,
    private readonly face: FaceRecognitionAdapter,
    private readonly voice: VoiceRecognitionAdapter,
  ) {}
  synthesize(request: VoiceCloneRequest): Promise<Uint8Array> {
    assertConsent(request.consent, request.subject, "voice-synthesis");
    if (!request.text.trim()) throw new Error("identity.text.empty");
    return this.voiceClone.synthesize(request);
  }
  async recognizeFace(frame: Uint8Array): Promise<IdentityProof | null> {
    if (!frame.length) throw new Error("identity.frame.empty");
    const result = await this.face.recognize(frame);
    return result ? { ...result, modality: "face", provider: this.face.id, verifiedAt: new Date().toISOString(), authorized: false } : null;
  }
  async recognizeVoice(audio: Uint8Array): Promise<IdentityProof | null> {
    if (!audio.length) throw new Error("identity.audio.empty");
    const result = await this.voice.recognize(audio);
    return result ? { ...result, modality: "voice", provider: this.voice.id, verifiedAt: new Date().toISOString(), authorized: false } : null;
  }
}
