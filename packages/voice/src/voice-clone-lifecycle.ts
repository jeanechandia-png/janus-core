/**
 * JANUS · estado del clon del Founder, independiente del proveedor y del robot.
 * La voz clonada está PENDIENTE hasta que exista evidencia verificable.
 * No fabrica/audio no llama APIs. Compatible con cualquier implementación local.
 */
import { assessLocalCloneReadiness, type VoiceCorpusManifest } from './voice-independence.js';

export type VoiceCloneProvider = 'elevenlabs' | 'janus-local';
export type VoiceCloneStage = 'pending' | 'samples-ready' | 'cloning' | 'needs-verification' | 'verified' | 'active' | 'revoked';
export interface VoiceCloneRecord {
  subject: 'founder';
  persona: 'janus';
  provider: VoiceCloneProvider;
  stage: VoiceCloneStage;
  /** ID del proveedor solo referencial; nunca autoriza acciones o declara calidad. */
  providerVoiceId?: string;
  corpus?: VoiceCorpusManifest;
  consentAt?: string;
  consentRevokedAt?: string;
  /** Evidencia objetiva de síntesis/escucha y aceptación explícita del Founder. */
  verification?: {
    acceptedByFounder: boolean;
    testedAt: string;
    testEvidenceRef: string;
    verifiedOwnership: boolean;
    qualityAccepted: boolean;
  };
}
export interface VoiceCloneAssessment {
  status: VoiceCloneStage;
  synthesizedVoiceConfirmed: boolean;
  readyForUse: boolean;
  blockers: string[];
  voiceOwner: 'founder';
  persona: 'janus';
  cloudPermissionRequired: boolean;
}

function validDate(value: string | undefined): boolean { return !!value && Number.isFinite(Date.parse(value)); }

/** No deriva una voz clonada de un id, una clave, una cuenta de pago ni un alias «Jean». */
export function assessFounderVoiceClone(record?: VoiceCloneRecord): VoiceCloneAssessment {
  if (!record) {
    return {
      status: 'pending', synthesizedVoiceConfirmed: false, readyForUse: false,
      voiceOwner: 'founder', persona: 'janus',
      blockers: ['No existe clon verificado; preparar grabaciones originales y consentimiento.'],
      cloudPermissionRequired: true,
    };
  }
  const blockers: string[] = [];
  if (record.subject !== 'founder' || record.persona !== 'janus') {
    blockers.push('El clon del Founder solo puede asignarse a la identidad JANUS.');
  }
  if (record.stage === 'revoked' || record.consentRevokedAt) blockers.push('Consentimiento revocado; la voz no puede utilizarse.');
  if (!validDate(record.consentAt)) blockers.push('Consentimiento del titular no documentado.');
  if (record.corpus) {
    const corpus = assessLocalCloneReadiness(record.corpus);
    if (!corpus.ready) blockers.push(...corpus.blockers);
  }
  // Un clon de ElevenLabs no es exportable como archivo y un voiceId no demuestra
  // ni titularidad, ni calidad, ni que esté realmente accesible.
  if (record.provider === 'elevenlabs' && (!record.providerVoiceId || !/^[A-Za-z0-9_-]{6,64}$/.test(record.providerVoiceId))) {
    blockers.push('Falta voice_id válido del clon en ElevenLabs.');
  }
  if (record.provider === 'janus-local' && !record.corpus) {
    blockers.push('El clon local requiere un corpus original auditado.');
  }
  const verification = record.verification;
  if (!verification || verification.acceptedByFounder !== true || verification.verifiedOwnership !== true
      || verification.qualityAccepted !== true || !verification.testEvidenceRef?.trim()
      || !validDate(verification.testedAt)) {
    blockers.push('Falta prueba real de voz, titularidad y aceptación explícita del Founder.');
  }
  if (!['verified', 'active'].includes(record.stage)) {
    blockers.push('El clon todavía está pendiente de completar y verificar.');
  }
  const readyForUse = blockers.length === 0;
  return {
    status: record.stage,
    synthesizedVoiceConfirmed: readyForUse,
    readyForUse,
    blockers,
    voiceOwner: 'founder',
    persona: 'janus',
    cloudPermissionRequired: record.provider === 'elevenlabs',
  };
}

/** Estado del runtime a partir de la configuración; nunca anunciar que el clon existe solo por tener API. */
export function declaredVoiceCloneStatus(env: Record<string, string | undefined>): {
  status: 'pending' | 'configured-unverified';
  provider: 'local' | 'elevenlabs';
  temporaryVoicePossible: boolean;
  cloneVerified: false;
} {
  const isCloud = env.JANUS_TTS_PROVIDER?.trim().toLowerCase() === 'elevenlabs';
  return {
    status: isCloud && !!env.JANUS_ELEVENLABS_VOICE_ID?.trim() ? 'configured-unverified' : 'pending',
    provider: isCloud ? 'elevenlabs' : 'local',
    temporaryVoicePossible: isCloud && !!env.JANUS_ELEVENLABS_VOICE_ID?.trim(),
    cloneVerified: false,
  };
}
