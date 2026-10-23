// Reading scripts for voice-clone references (ADR-012) and a pure transcript check.
//
// Why a script: a clone needs the EXACT transcript of the reference audio (ADR-009 rule 4). If the person reads
// a known text, the transcript is known by construction; when a speech-to-text adapter is available we also
// compare what was actually said with the text, so a misread or a noisy take is caught before enrolment.
// The texts are original, neutral and contain no personal data (this repository is public).

export type CloneSubject = 'founder' | 'kendra';

export interface CloneScript {
  subject: CloneSubject;
  language: 'es';
  text: string;
  /** Rough reading time at a calm pace (~150 words per minute). */
  approxSeconds: number;
}

const FOUNDER_TEXT = [
  'Hola, soy Jean y esta es mi voz natural.',
  'Estoy leyendo este texto con calma, como si le hablara a un amigo en una mañana tranquila.',
  'Trabajo con inteligencia artificial, páginas web y asistentes virtuales, y me gusta explicar las cosas de forma clara y sencilla.',
  '¿Sabes qué hora es? Son las ocho y cuarenta y cinco de la mañana, y tengo tres cosas pendientes: una llamada, un informe y una reunión.',
  'Si algo sale mal, no pasa nada: se corrige, se aprende y se sigue adelante.',
  '¡Qué buena noticia! Hemos terminado el primer paso y todo funciona como esperábamos.',
  'Ahora te cuento tres ideas: primero, cuidar a la familia; segundo, trabajar con constancia; tercero, no rendirse nunca.',
  'Gracias por escucharme, y hasta pronto.',
].join(' ');

const KENDRA_TEXT = [
  'Hola, me llamo Kendra.',
  'Hoy aprendí algo nuevo y me divertí mucho.',
  'Me gustan los animales, los dibujos y las historias.',
  '¿Sabes contar hasta diez? Uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez.',
  '¡Lo logré!',
  'Si algo no sale a la primera, lo intento otra vez.',
  'Gracias por jugar conmigo.',
].join(' ');

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export const CLONE_SCRIPTS: Readonly<Record<CloneSubject, CloneScript>> = Object.freeze({
  founder: { subject: 'founder', language: 'es', text: FOUNDER_TEXT, approxSeconds: Math.round((words(FOUNDER_TEXT) / 150) * 60) },
  kendra: { subject: 'kendra', language: 'es', text: KENDRA_TEXT, approxSeconds: Math.round((words(KENDRA_TEXT) / 150) * 60) },
});

export function cloneScript(subject: CloneSubject): CloneScript {
  return CLONE_SCRIPTS[subject];
}

function normalizeWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export interface TranscriptMatch {
  wordErrorRate: number;
  ok: boolean;
  expectedWords: number;
}

/** Word error rate (edit distance over words) between the text the person should read and what was heard. */
export function transcriptMatch(expected: string, heard: string, maxWordErrorRate = 0.3): TranscriptMatch {
  const a = normalizeWords(expected);
  const b = normalizeWords(heard);
  if (a.length === 0) return { wordErrorRate: 1, ok: false, expectedWords: 0 };
  const previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(above + 1, previous[j - 1]! + 1, diagonal + cost);
      diagonal = above;
    }
  }
  const wordErrorRate = Math.min(1, previous[b.length]! / a.length);
  return { wordErrorRate, ok: wordErrorRate <= maxWordErrorRate, expectedWords: a.length };
}
