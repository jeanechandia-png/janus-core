/**
 * Independencia de voz: ElevenLabs es un proveedor TEMPORAL y reemplazable.
 *
 * Decisión del Founder (2026-11-04): el clon de la voz de Jean debe poder hacerse
 * con medios propios (motor local Qwen3-TTS en modo `voice_clone`) para no depender
 * de ningún proveedor.
 *
 * Hechos verificados que condicionan el diseño:
 * - ElevenLabs NO permite descargar ni exportar un clon como archivo
 *   (centro de ayuda oficial: «You cannot download or export your voice clones as standalone files»).
 *   Lo portable son las GRABACIONES ORIGINALES, no el clon alojado.
 * - Los términos de ElevenLabs prohíben (según resumen de terceros, a confirmar con el texto
 *   oficial) usar su salida como datos de entrenamiento de modelos competidores. Por eso el
 *   corpus del clon propio se construye SOLO con grabaciones originales del titular de la voz,
 *   nunca con audio generado por un proveedor (`provenance: 'provider-output'` se rechaza).
 *
 * Este módulo es puro: no lee audio, no guarda biometría y no llama a ningún proveedor.
 * El manifiesto describe metadatos (id, duración, huella, procedencia); el audio vive fuera de
 * Git (`voices/private/`, ignorado) y fuera de SQLite.
 */

export type VoiceSampleProvenance = 'original-recording' | 'provider-output' | 'unknown';

export interface VoiceCorpusSample {
  id: string;
  provenance: VoiceSampleProvenance;
  durationSeconds: number;
  /** SHA-256 hexadecimal del archivo local (integridad y detección de duplicados). */
  sha256: string;
  /** El archivo existe en disco local, fuera de Git. */
  storedLocally: boolean;
  /** Existe transcripción exacta (necesaria para `ref_text` del clon local). */
  hasTranscript: boolean;
  /** Ruido/eco aceptable según revisión del titular. */
  cleanAudioConfirmed?: boolean;
}

export interface VoiceCorpusConsent {
  grantedAt: string;
  /** Quién consiente: el propio titular o un tutor verificado (menores). */
  grantedBy: 'subject' | 'guardian';
  /** Alcance legible, p. ej. «voz de Janus para uso interno». */
  scope: string;
  revokedAt?: string;
}

export interface VoiceCorpusManifest {
  subject: string;
  /** El titular es menor de edad; exige consentimiento de tutor verificado. */
  subjectIsMinor?: boolean;
  consent?: VoiceCorpusConsent;
  samples: VoiceCorpusSample[];
}

export interface LocalCloneReadinessOptions {
  /** Mínimo de segundos de referencia limpia para considerar el clon utilizable. Umbral operativo de Janus, no requisito del motor. */
  minReferenceSeconds?: number;
  /** Segundos recomendados para calidad estable. Umbral operativo de Janus. */
  recommendedSeconds?: number;
}

export interface LocalCloneReadiness {
  ready: boolean;
  usableSeconds: number;
  usableSampleIds: string[];
  blockers: string[];
  warnings: string[];
}

const DEFAULT_MIN_SECONDS = 10;
const DEFAULT_RECOMMENDED_SECONDS = 60;

export function assessLocalCloneReadiness(
  manifest: VoiceCorpusManifest,
  options: LocalCloneReadinessOptions = {},
): LocalCloneReadiness {
  const minSeconds = positive(options.minReferenceSeconds, DEFAULT_MIN_SECONDS);
  const recommended = Math.max(minSeconds, positive(options.recommendedSeconds, DEFAULT_RECOMMENDED_SECONDS));
  const blockers: string[] = [];
  const warnings: string[] = [];

  const consent = manifest.consent;
  if (!consent) {
    blockers.push('Falta el consentimiento registrado del titular de la voz.');
  } else {
    if (!isValidDate(consent.grantedAt)) blockers.push('La fecha del consentimiento no es válida.');
    if (consent.revokedAt) blockers.push('El consentimiento fue revocado; el clon local debe darse de baja.');
    if (!consent.scope.trim()) blockers.push('El consentimiento no declara su alcance.');
    if (manifest.subjectIsMinor && consent.grantedBy !== 'guardian') {
      blockers.push('Titular menor de edad: se exige consentimiento de tutor verificado.');
    }
  }
  if (manifest.subjectIsMinor && !consent) {
    blockers.push('Titular menor de edad: se exige consentimiento de tutor verificado.');
  }

  const seenHashes = new Set<string>();
  const usable: VoiceCorpusSample[] = [];
  for (const sample of manifest.samples) {
    if (sample.provenance === 'provider-output') {
      blockers.push(
        `La muestra «${sample.id}» es audio generado por un proveedor: no se usa para entrenar ni clonar (términos del proveedor y política de independencia).`,
      );
      continue;
    }
    if (sample.provenance !== 'original-recording') {
      warnings.push(`La muestra «${sample.id}» no declara procedencia; se excluye hasta confirmar que es grabación original.`);
      continue;
    }
    if (!sample.storedLocally) {
      warnings.push(`La muestra «${sample.id}» no está guardada localmente; se excluye.`);
      continue;
    }
    if (!sample.hasTranscript) {
      warnings.push(`La muestra «${sample.id}» no tiene transcripción exacta; se excluye.`);
      continue;
    }
    if (!/^[0-9a-f]{64}$/i.test(sample.sha256)) {
      warnings.push(`La muestra «${sample.id}» no tiene huella SHA-256 válida; se excluye.`);
      continue;
    }
    if (!(sample.durationSeconds > 0)) {
      warnings.push(`La muestra «${sample.id}» no tiene duración válida; se excluye.`);
      continue;
    }
    const hash = sample.sha256.toLowerCase();
    if (seenHashes.has(hash)) {
      warnings.push(`La muestra «${sample.id}» duplica otra; se cuenta una sola vez.`);
      continue;
    }
    seenHashes.add(hash);
    if (sample.cleanAudioConfirmed !== true) {
      warnings.push(`La muestra «${sample.id}» no tiene confirmada la limpieza del audio (ruido/eco); se excluye.`);
      continue;
    }
    usable.push(sample);
  }

  const usableSeconds = round1(usable.reduce((sum, sample) => sum + sample.durationSeconds, 0));
  if (usableSeconds < minSeconds) {
    blockers.push(
      `Audio de referencia utilizable insuficiente: ${usableSeconds}s de ${minSeconds}s mínimos (umbral operativo de Janus).`,
    );
  } else if (usableSeconds < recommended) {
    warnings.push(`Audio utilizable ${usableSeconds}s; se recomiendan ${recommended}s para calidad estable.`);
  }

  return {
    ready: blockers.length === 0,
    usableSeconds,
    usableSampleIds: usable.map((sample) => sample.id),
    blockers,
    warnings,
  };
}

export interface IndependenceGates {
  /** La síntesis local funciona con el acceso externo bloqueado (prueba registrada). */
  localSynthesisVerifiedOffline: boolean;
  /** El flujo central arranca y completa sin ELEVENLABS_API_KEY. */
  coreFlowWorksWithoutProviderKey: boolean;
  /** Consentimiento, alta/baja y aislamiento por titular verificados. */
  consentAndRevocationVerified: boolean;
  /** Comparativa de calidad/latencia/coste registrada con pruebas permitidas y grabaciones independientes. */
  benchmarkRecorded: boolean;
  /** El Founder aceptó por escrito la calidad del clon local. */
  founderAcceptedLocalVoice: boolean;
}

export interface IndependenceDecision {
  canRetireProvider: boolean;
  missing: string[];
}

const GATE_LABELS: Record<keyof IndependenceGates, string> = {
  localSynthesisVerifiedOffline: 'Síntesis local verificada con el acceso externo bloqueado',
  coreFlowWorksWithoutProviderKey: 'Flujo central completo sin clave del proveedor',
  consentAndRevocationVerified: 'Consentimiento, revocación y aislamiento verificados',
  benchmarkRecorded: 'Comparativa de calidad, latencia y coste registrada',
  founderAcceptedLocalVoice: 'Aceptación del Founder de la voz local',
};

/** Ninguna baja del proveedor ni cambio de producción sin aceptación local documentada. */
export function evaluateProviderRetirement(gates: IndependenceGates): IndependenceDecision {
  const missing = (Object.keys(GATE_LABELS) as Array<keyof IndependenceGates>)
    .filter((key) => gates[key] !== true)
    .map((key) => GATE_LABELS[key]);
  return { canRetireProvider: missing.length === 0, missing };
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function isValidDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
