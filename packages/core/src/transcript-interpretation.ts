/**
 * Transcript Interpretation — tolerance to dictation / speech-to-text errors.
 *
 * Founder rule (2026-10-13): a word may be misspelled or changed by the
 * transcription ("Llanos" for "Janus", "Infinity Group" / "Infinity Shift"
 * for "InfinitySeed Group", "IVA" for "IBA"). Janus must consider that the
 * transcription may be wrong, check whether each word fits the conversation
 * context, and resolve the most probable meaning — without ever losing what
 * was actually said and without silently changing sensitive instructions.
 *
 * Principles:
 * - The original text is always preserved; interpretation is additive.
 * - Known transcription errors (curated aliases) are strong evidence.
 * - Ambiguous aliases that are also ordinary words ("llanos" = plains,
 *   "IVA" = VAT) are only resolved when the surrounding context supports it,
 *   and are blocked by contrary context (tax vocabulary for IVA).
 * - Fuzzy matches are suggestions, never silent rewrites.
 * - Commands that would change, send, delete, publish or pay something never
 *   get auto-applied corrections: Janus asks for confirmation instead.
 * - Quoted text, code, URLs, e-mails and paths are never touched.
 */

export interface LexiconTerm {
  canonical: string;
  /** Known transcription/dictation errors for this term. */
  aliases: readonly string[];
  /** Aliases that are also ordinary words: require ecosystem context. */
  ambiguousAliases?: readonly string[];
  /** Words that, when present, mean an ambiguous alias keeps its ordinary meaning. */
  contraryContext?: readonly string[];
  /** Domain the term belongs to; co-occurring domain terms raise confidence. */
  domain: string;
}

export const DEFAULT_TRANSCRIPT_LEXICON: readonly LexiconTerm[] = Object.freeze([
  {
    canonical: 'Janus',
    aliases: ['janos', 'yanus', 'yanos', 'jhanus', 'janu s', 'jano s'],
    ambiguousAliases: ['llanos', 'llanus', 'jano', 'genus'],
    domain: 'infinityseed',
  },
  {
    canonical: 'InfinitySeed Group',
    // Only full-name mis-hearings: never expand a correct short form ("InfinitySeed") into the full name.
    aliases: ['infinity seed group', 'infiniti seed group', 'infinity sid group', 'infinity cid group', 'infinity shift', 'infinity shift group', 'infinity group'],
    domain: 'infinityseed',
  },
  {
    canonical: 'ChatBox',
    aliases: ['chap box', 'shatbox', 'chat vox', 'chad box', 'chatbots box'],
    domain: 'infinityseed',
  },
  {
    canonical: 'IBA',
    aliases: ['i b a', 'i be a'],
    ambiguousAliases: ['iva'],
    contraryContext: ['impuesto', 'impuestos', 'factura', 'facturas', 'declaracion', 'hacienda', 'tax', 'btw', 'porcentaje', 'deducible', 'retencion', '%'],
    domain: 'infinityseed',
  },
  { canonical: 'Hostinger', aliases: ['hostinguer', 'hosting er', 'jostinger', 'hostinyer'], domain: 'infra' },
  { canonical: 'Netlify', aliases: ['netlifai', 'net lify', 'netlifi', 'nedlify'], domain: 'infra' },
  { canonical: 'Vercel', aliases: ['versel', 'bercel', 'vercell', 'ver cel'], domain: 'infra' },
  { canonical: 'Supabase', aliases: ['super base', 'supa base', 'superbase', 'soupabase'], domain: 'infra' },
  { canonical: 'GitHub', aliases: ['git hub', 'guithub', 'gitjab', 'git jab', 'guit hub'], domain: 'infra' },
]);

export interface TranscriptCorrection {
  original: string;
  canonical: string;
  start: number;
  end: number;
  confidence: number;
  basis: 'known_alias' | 'contextual_alias' | 'fuzzy';
  applied: boolean;
  reason: string;
}

export interface TranscriptInterpretation {
  originalText: string;
  interpretedText: string;
  /** Text with every plausible correction applied — offered to the human, never executed without confirmation. */
  suggestedText: string;
  corrections: TranscriptCorrection[];
  /** True when at least one plausible correction was NOT applied and needs the human. */
  needsConfirmation: boolean;
  /** Short human-facing question, in Spanish, when confirmation is needed. */
  confirmationPrompt: string | null;
  sensitiveCommand: boolean;
  policyVersion: string;
}

export const TRANSCRIPT_INTERPRETATION_POLICY_VERSION = 'transcript-interpretation-v1';
const APPLY_THRESHOLD = 0.85;
const SUGGEST_THRESHOLD = 0.6;

const SENSITIVE_VERBS = [
  'publica', 'publicar', 'publish', 'borra', 'borrar', 'elimina', 'eliminar', 'delete', 'remove',
  'envia', 'enviar', 'manda', 'mandar', 'send', 'paga', 'pagar', 'pay', 'transfiere', 'transferir',
  'despliega', 'desplegar', 'deploy', 'merge', 'fusiona', 'push', 'revoca', 'revocar', 'aprueba', 'aprobar',
  'compra', 'comprar', 'cancela', 'cancelar', 'firma', 'firmar',
];

export function interpretTranscript(input: {
  text: string;
  /** Recent conversation lines from the same session (oldest first). */
  context?: readonly string[];
  lexicon?: readonly LexiconTerm[];
}): TranscriptInterpretation {
  const text = input.text;
  const lexicon = input.lexicon ?? DEFAULT_TRANSCRIPT_LEXICON;
  const protectedRanges = findProtectedRanges(text);
  const normalizedFull = normalize([...(input.context ?? []), text].join(' \n '));
  const words = tokenize(text);
  const sensitiveCommand = words.some((word) => SENSITIVE_VERBS.includes(word.norm));

  const candidates: TranscriptCorrection[] = [];

  for (const term of lexicon) {
    const canonicalNorm = normalize(term.canonical);
    const contextScore = domainContextScore(term, lexicon, normalizedFull, canonicalNorm);
    const contrary = (term.contraryContext ?? []).some((word) => hasWord(normalizedFull, word));

    const aliasGroups: Array<{ aliases: readonly string[]; ambiguous: boolean }> = [
      { aliases: term.aliases, ambiguous: false },
      { aliases: term.ambiguousAliases ?? [], ambiguous: true },
    ];
    for (const group of aliasGroups) {
      for (const alias of group.aliases) {
        for (const match of findPhrase(words, normalize(alias))) {
          const surface = text.slice(match.start, match.end);
          if (normalize(surface) === canonicalNorm || surface === term.canonical) continue;
          if (isProtected(match.start, match.end, protectedRanges)) continue;
          let confidence: number;
          let basis: TranscriptCorrection['basis'];
          let reason: string;
          if (!group.ambiguous) {
            confidence = Math.min(0.97, 0.9 + contextScore * 0.07);
            basis = 'known_alias';
            reason = 'error de transcripción conocido para ' + term.canonical;
          } else {
            if (contrary) continue;
            if (contextScore <= 0) continue;
            confidence = Math.min(0.92, 0.55 + contextScore * 0.35);
            basis = 'contextual_alias';
            reason = '«' + surface + '» también es una palabra común; el contexto de la conversación apunta a ' + term.canonical;
          }
          candidates.push({ original: surface, canonical: term.canonical, start: match.start, end: match.end, confidence, basis, applied: false, reason });
        }
      }
    }

    // Fuzzy: single words close (after phonetic folding) to a one-word canonical term.
    if (!canonicalNorm.includes(' ') && canonicalNorm.length >= 4) {
      const canonicalKey = phoneticKey(canonicalNorm);
      for (const word of words) {
        if (word.norm === canonicalNorm || word.norm.length < 4) continue;
        if (isProtected(word.start, word.end, protectedRanges)) continue;
        const knownAlias = [...term.aliases, ...(term.ambiguousAliases ?? [])].some((alias) => normalize(alias) === word.norm);
        if (knownAlias) continue;
        const distance = levenshtein(phoneticKey(word.norm), canonicalKey);
        if (distance === 0 || distance > 1) continue;
        if (contextScore <= 0 || contrary) continue;
        const confidence = Math.min(0.8, 0.5 + contextScore * 0.3);
        candidates.push({
          original: text.slice(word.start, word.end),
          canonical: term.canonical,
          start: word.start,
          end: word.end,
          confidence,
          basis: 'fuzzy',
          applied: false,
          reason: 'se parece fonéticamente a ' + term.canonical + ' y encaja con el contexto',
        });
      }
    }
  }

  const corrections = resolveOverlaps(candidates)
    .filter((candidate) => candidate.confidence >= SUGGEST_THRESHOLD)
    .map((candidate) => ({
      ...candidate,
      applied: candidate.confidence >= APPLY_THRESHOLD && !sensitiveCommand && candidate.basis !== 'fuzzy',
    }))
    .sort((a, b) => a.start - b.start);

  const interpretedText = applyCorrections(text, corrections.filter((correction) => correction.applied));
  const suggestedText = applyCorrections(text, corrections);

  const pending = corrections.filter((correction) => !correction.applied);
  return {
    originalText: text,
    interpretedText,
    suggestedText,
    corrections,
    needsConfirmation: pending.length > 0,
    confirmationPrompt: pending.length > 0
      ? '¿Quisiste decir ' + pending.map((c) => '«' + c.canonical + '» en lugar de «' + c.original + '»').join(' y ') + '?'
      : null,
    sensitiveCommand,
    policyVersion: TRANSCRIPT_INTERPRETATION_POLICY_VERSION,
  };
}

/**
 * Vocabulary hint for speech-to-text engines (e.g. whisper.cpp `prompt`).
 * Prevents errors at the source by biasing recognition toward canonical names.
 */
export function transcriptionVocabularyPrompt(lexicon: readonly LexiconTerm[] = DEFAULT_TRANSCRIPT_LEXICON): string {
  return 'Vocabulario: ' + lexicon.map((term) => term.canonical).join(', ') + '.';
}

// ---------------------------------------------------------------- helpers

function applyCorrections(text: string, corrections: readonly TranscriptCorrection[]): string {
  let output = '';
  let cursor = 0;
  for (const correction of [...corrections].sort((a, b) => a.start - b.start)) {
    output += text.slice(cursor, correction.start) + correction.canonical;
    cursor = correction.end;
  }
  return output + text.slice(cursor);
}

interface Word { norm: string; start: number; end: number }

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

function tokenize(text: string): Word[] {
  const words: Word[] = [];
  const pattern = /[\p{L}\p{N}%]+/gu;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    words.push({ norm: normalize(match[0]), start, end: start + match[0].length });
  }
  return words.filter((word) => word.norm.length > 0);
}

function findPhrase(words: readonly Word[], phrase: string): Array<{ start: number; end: number }> {
  const parts = phrase.split(' ').filter(Boolean);
  const found: Array<{ start: number; end: number }> = [];
  if (parts.length === 0) return found;
  for (let i = 0; i + parts.length <= words.length; i += 1) {
    let ok = true;
    for (let j = 0; j < parts.length; j += 1) {
      if (words[i + j]!.norm !== parts[j]) { ok = false; break; }
    }
    if (ok) found.push({ start: words[i]!.start, end: words[i + parts.length - 1]!.end });
  }
  return found;
}

function hasWord(normalizedText: string, word: string): boolean {
  const target = normalize(word) || word;
  if (target === '%') return normalizedText.includes('%');
  return (' ' + normalizedText.replace(/\s+/g, ' ') + ' ').includes(' ' + target + ' ');
}

/** 0..1 — how strongly the conversation is about this term's domain. */
function domainContextScore(
  term: LexiconTerm,
  lexicon: readonly LexiconTerm[],
  normalizedText: string,
  canonicalNorm: string,
): number {
  let score = 0;
  if (normalizedText.includes(canonicalNorm)) score += 0.5;
  for (const other of lexicon) {
    if (other === term || other.domain !== term.domain) continue;
    const forms = [other.canonical, ...other.aliases].map(normalize);
    if (forms.some((form) => form && (' ' + normalizedText + ' ').includes(' ' + form + ' '))) score += 0.35;
  }
  return Math.min(1, score);
}

function phoneticKey(word: string): string {
  return word
    .replace(/ll/g, 'y')
    .replace(/j/g, 'y')
    .replace(/[vw]/g, 'b')
    .replace(/[zc](?=[ei])/g, 's')
    .replace(/z/g, 's')
    .replace(/qu/g, 'k')
    .replace(/c/g, 'k')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1');
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

function findProtectedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const patterns = [
    /`[^`]*`/g,
    /"[^"]*"|“[^”]*”|«[^»]*»/g,
    /\bhttps?:\/\/\S+/g,
    /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
    /(?:^|\s)(?:\.{0,2}\/|~\/)[\w./-]+/g,
    /\b[\w-]+\/[\w./-]+\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      ranges.push([start, start + match[0].length]);
    }
  }
  return ranges;
}

function isProtected(start: number, end: number, ranges: ReadonlyArray<[number, number]>): boolean {
  return ranges.some(([from, to]) => start < to && end > from);
}

function resolveOverlaps(candidates: readonly TranscriptCorrection[]): TranscriptCorrection[] {
  const sorted = [...candidates].sort((a, b) => (b.end - b.start) - (a.end - a.start) || b.confidence - a.confidence);
  const kept: TranscriptCorrection[] = [];
  for (const candidate of sorted) {
    if (kept.some((other) => candidate.start < other.end && candidate.end > other.start)) continue;
    kept.push(candidate);
  }
  return kept;
}
