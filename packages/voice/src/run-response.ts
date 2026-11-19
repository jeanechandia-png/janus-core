import type { JanusEvent, RunSnapshot } from '../../core/src/events.js';

const MAX_SPOKEN_PREVIEW_CHARS = 420;

export function safeSpokenRunSummary(
  snapshot: RunSnapshot,
  events: readonly JanusEvent[],
): string | undefined {
  if (snapshot.status === 'cancelled') return undefined;

  const evidence = latestSafePreview(events);
  // La voz comparte la misma política de incertidumbre que el texto. Una respuesta
  // factual rechazada no debe convertirse en un «Listo» confiado al sintetizarse.
  if (evidence?.blocked) return 'No puedo confirmar esa información con la evidencia disponible. La respuesta está bloqueada para revisión.';
  const preview = evidence?.preview;
  if (snapshot.status === 'completed') {
    if (evidence?.probable) return preview
      ? `La información es probable, pero no está completamente confirmada. ${preview}`
      : 'La información es probable, pero no está completamente confirmada.';
    return preview ? `Listo. ${preview}` : 'Listo. La tarea terminó.';
  }
  if (snapshot.status === 'blocked') {
    return preview
      ? `La tarea necesita atención. ${preview}`
      : 'La tarea necesita atención antes de continuar.';
  }
  if (snapshot.status === 'failed') {
    return 'La tarea terminó con un error y necesita revisión.';
  }
  return undefined;
}

function latestSafePreview(events: readonly JanusEvent[]): { preview?: string; probable?: boolean; blocked?: boolean } | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type !== 'artifact.updated') continue;
    // Sólo etiquetas explícitas emitidas por el backend. Nunca se interpreta el
    // texto generado por la IA como una etiqueta de confianza.
    const verdict = event.payload?.citationVerdict ?? event.payload?.researchVerdict;
    if (verdict === 'RECHAZADO' || verdict === 'DESCARTADO' || verdict === 'POR CONFIRMAR') return { blocked: true };
    const preview = event.payload?.preview;
    if (typeof preview !== 'string') continue;
    const clean = sanitizeForSpeech(preview);
    if (clean) return { preview: clean, ...(verdict === 'PROBABLE' ? { probable: true } : {}) };
  }
  return undefined;
}

export function sanitizeForSpeech(value: string): string {
  const clean = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  if (clean.length <= MAX_SPOKEN_PREVIEW_CHARS) return clean;
  return `${clean.slice(0, MAX_SPOKEN_PREVIEW_CHARS - 1).trimEnd()}…`;
}
