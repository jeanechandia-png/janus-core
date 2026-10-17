/**
 * Voice Identity — módulo reutilizable (candidato REUSABLE_CAPABILITY).
 * Productization tag: REUSABLE_CAPABILITY · contains_personal_data = FALSE
 *
 * Distingue tres cosas que NO deben mezclarse:
 *   1. identificar la voz   (¿es la persona inscrita?)      -> este módulo
 *   2. entender el discurso (STT / intención)                -> otro adaptador
 *   3. autorizar la acción  (política de seguridad)          -> este módulo, sin delegar en la voz sola
 *
 * Invariantes:
 *  - La plantilla de voz solo se referencia desde almacenamiento seguro; nunca se guarda aquí.
 *  - La inscripción exige consentimiento registrado de la propia persona. Es revocable y borrable.
 *  - La voz NUNCA es el único factor para acciones sensibles.
 *  - Si la verificación es dudosa, se ofrece método alternativo; no se bloquea a la persona.
 *  - Sin puntaje anti-suplantación (voz sintética/grabada) no se acepta coincidencia de voz.
 */
import { createHash } from 'node:crypto';
import {
  validateBiometricTemplateRef,
  type BiometricTemplateRef,
  type PresenceEvidence,
  type PresenceFactor,
} from './identity-presence.js';

export type ActionSensitivity = 'low' | 'medium' | 'sensitive';
export type VoiceDecision = 'accepted' | 'needs_second_factor' | 'fallback_alternative' | 'rejected';

export interface VoiceConsent {
  principalId: string;
  grantedBy: string; // la propia persona, o representante legal acreditado
  grantedAt: string;
  purpose: string;
  revokedAt?: string;
}

export interface VoiceVerifierResult {
  /** Similitud con la plantilla inscrita, 0..1. Lo calcula un adaptador reemplazable. */
  matchScore: number;
  /** Confianza de que la voz es real y presente (no sintética ni grabada), 0..1. */
  antiSpoofScore?: number;
  /** Segundos de voz útil analizados. */
  speechSeconds: number;
  modelId: string;
  modelVersion: string;
}

/** Contrato que implementa cualquier motor (local o de proveedor). El núcleo no depende de ninguno. */
export interface SpeakerVerifierAdapter {
  verify(input: { templateRef: BiometricTemplateRef; audioRef: string }): Promise<VoiceVerifierResult>;
}

export interface VoiceIdentityPolicy {
  minimumMatchScore: number;
  minimumAntiSpoofScore: number;
  minimumSpeechSeconds: number;
  /** Margen que se tolera a quien tiene habla atípica; nunca baja el umbral de anti-suplantación. */
  atypicalSpeechMatchScoreRelief: number;
  maxConsecutiveFailuresBeforeFallback: number;
  /** Factores adicionales aceptados como segunda validación, por sensibilidad. */
  secondFactors: Record<Exclude<ActionSensitivity, 'low'>, PresenceFactor[]>;
}

export const DEFAULT_VOICE_IDENTITY_POLICY: VoiceIdentityPolicy = {
  minimumMatchScore: 0.8,
  minimumAntiSpoofScore: 0.8,
  minimumSpeechSeconds: 3,
  atypicalSpeechMatchScoreRelief: 0.05,
  maxConsecutiveFailuresBeforeFallback: 2,
  secondFactors: {
    medium: ['trusted_device', 'pin'],
    sensitive: ['pin', 'recovery_key'],
  },
};

export interface VoiceDecisionResult {
  decision: VoiceDecision;
  reason: string;
  evidence?: PresenceEvidence;
  auditHash: string;
}

export function validateVoiceTemplateRef(ref: BiometricTemplateRef): void {
  if (ref.modality !== 'voice') throw new Error('Voice template reference must have modality voice');
  validateBiometricTemplateRef(ref);
}

export function assertActiveConsent(consent: VoiceConsent, now = new Date().toISOString()): void {
  if (!consent.principalId.trim() || !consent.grantedBy.trim()) throw new Error('Voice consent requires principal and grantor');
  if (!consent.purpose.trim()) throw new Error('Voice consent requires a stated purpose');
  if (consent.revokedAt && consent.revokedAt <= now) throw new Error('Voice consent has been revoked');
}

/** Revoca: el consentimiento queda cerrado y la plantilla se marca para borrado. */
export function revokeVoiceEnrollment(
  consent: VoiceConsent,
  template: BiometricTemplateRef,
  now = new Date().toISOString(),
): { consent: VoiceConsent; template: BiometricTemplateRef; deleteTemplateRef: string } {
  return {
    consent: { ...consent, revokedAt: now },
    template: { ...template, revokedAt: now },
    deleteTemplateRef: template.secureStoreRef,
  };
}

export function evaluateVoiceAttempt(input: {
  result: VoiceVerifierResult;
  template: BiometricTemplateRef;
  consent: VoiceConsent;
  sensitivity: ActionSensitivity;
  /** Factores ya verificados por otras vías en esta sesión. */
  otherVerifiedFactors?: PresenceFactor[];
  consecutiveFailures?: number;
  atypicalSpeechMode?: boolean;
  policy?: VoiceIdentityPolicy;
  now?: string;
}): VoiceDecisionResult {
  const policy = input.policy ?? DEFAULT_VOICE_IDENTITY_POLICY;
  const now = input.now ?? new Date().toISOString();
  validateVoiceTemplateRef(input.template);
  assertActiveConsent(input.consent, now);
  if (input.template.revokedAt && input.template.revokedAt <= now) throw new Error('Voice template has been revoked');
  if (input.template.principalId !== input.consent.principalId) throw new Error('Consent and template belong to different principals');
  if (input.result.modelId !== input.template.modelId || input.result.modelVersion !== input.template.modelVersion) {
    return finish('fallback_alternative', 'El modelo de verificación no coincide con el de la inscripción', input, now);
  }

  const relief = input.atypicalSpeechMode ? policy.atypicalSpeechMatchScoreRelief : 0;
  const matchOk = input.result.matchScore >= policy.minimumMatchScore - relief;
  const spoofOk = (input.result.antiSpoofScore ?? 0) >= policy.minimumAntiSpoofScore;
  const longEnough = input.result.speechSeconds >= policy.minimumSpeechSeconds;

  if (!spoofOk) {
    return finish('rejected', 'Sin garantía de voz real y presente (anti-suplantación insuficiente o ausente)', input, now);
  }
  if (!matchOk || !longEnough) {
    const failures = (input.consecutiveFailures ?? 0) + 1;
    return failures >= policy.maxConsecutiveFailuresBeforeFallback
      ? finish('fallback_alternative', 'Voz no concluyente: ofrecer método alternativo', input, now)
      : finish('rejected', 'Voz no concluyente: pedir repetir con una frase corta', input, now);
  }

  const evidence: PresenceEvidence = {
    factor: 'voice_match',
    verified: true,
    score: input.result.matchScore,
    observedAt: now,
    evidenceRef: `voice:${input.result.modelId}@${input.result.modelVersion}`,
  };

  if (input.sensitivity === 'low') return finish('accepted', 'Voz verificada para acción de bajo riesgo', input, now, evidence);

  const accepted = policy.secondFactors[input.sensitivity];
  const hasSecond = (input.otherVerifiedFactors ?? []).some((f) => accepted.includes(f));
  return hasSecond
    ? finish('accepted', 'Voz verificada más segunda validación', input, now, evidence)
    : finish('needs_second_factor', `La voz sola no basta; requiere uno de: ${accepted.join(', ')}`, input, now, evidence);
}

function finish(
  decision: VoiceDecision,
  reason: string,
  input: { template: BiometricTemplateRef; sensitivity: ActionSensitivity },
  now: string,
  evidence?: PresenceEvidence,
): VoiceDecisionResult {
  const auditHash = createHash('sha256')
    .update(JSON.stringify({ p: input.template.principalId, s: input.sensitivity, d: decision, t: now }))
    .digest('hex');
  return { decision, reason, evidence, auditHash };
}
