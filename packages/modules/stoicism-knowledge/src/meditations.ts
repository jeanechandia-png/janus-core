import { MEDITATIONS_DIGESTS } from './meditations-digests.js';
import { MEDITATIONS_TEXT } from './meditations-text.js';
import type { BookDigest, KeyPassage, MeditationsHit } from './types.js';

export const BOOK_COUNT = 12;

/** Plain-text normalisation: lower case, no accents, single spaces. */
export function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

export function isValidBook(book: number): boolean {
  return Number.isInteger(book) && book >= 1 && book <= BOOK_COUNT;
}

export function paragraphCount(book: number): number {
  return isValidBook(book) ? MEDITATIONS_TEXT[book]!.length : 0;
}

export function totalParagraphs(): number {
  let total = 0;
  for (let book = 1; book <= BOOK_COUNT; book += 1) total += paragraphCount(book);
  return total;
}

export function getBookDigest(book: number): BookDigest | undefined {
  return MEDITATIONS_DIGESTS.find((digest) => digest.book === book);
}

export interface Passage {
  book: number;
  paragraph: number;
  text: string;
  keyPassage?: KeyPassage;
}

export function getPassage(book: number, paragraph: number): Passage | undefined {
  if (!isValidBook(book)) return undefined;
  const paragraphs = MEDITATIONS_TEXT[book]!;
  if (!Number.isInteger(paragraph) || paragraph < 1 || paragraph > paragraphs.length) return undefined;
  const keyPassage = getBookDigest(book)?.keyPassages.find((candidate) => candidate.paragraph === paragraph);
  return { book, paragraph, text: paragraphs[paragraph - 1]!, ...(keyPassage ? { keyPassage } : {}) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Search: Spanish or English query -> English concepts -> paragraphs of Long's text. Deterministic, no network.
// ---------------------------------------------------------------------------------------------------------------------

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'u', 'e', 'en', 'con', 'por', 'para', 'que', 'se', 'su', 'sus', 'lo', 'le', 'les', 'me', 'mi', 'tu', 'es', 'son', 'fue', 'ser',
  'como', 'mas', 'muy', 'sobre', 'acerca', 'hay', 'donde', 'dice', 'dicen', 'dijo', 'busca', 'buscar', 'busco', 'encuentra', 'encontrar', 'pasaje', 'pasajes', 'parrafo', 'parrafos', 'cita', 'citas', 'frase', 'frases',
  'libro', 'libros', 'meditaciones', 'meditation', 'meditations', 'marco', 'aurelio', 'marcus', 'aurelius', 'estoico', 'estoicismo', 'janus',
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'and', 'or', 'is', 'are', 'about', 'what', 'where', 'does', 'say', 'says', 'find', 'search', 'passage', 'quote', 'book',
  'dame', 'dime', 'muestrame', 'quiero', 'puedes', 'algo', 'todo', 'todos', 'cuando', 'cual', 'cuales', 'tiene', 'tienen', 'habla', 'hablar',
]);

/** Spanish word stem (prefix) -> English forms to look for in Long's text. */
const LEXICON: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['muert', ['death', 'die', 'dies', 'died', 'dying', 'dead', 'mortal']],
  ['morir', ['death', 'die', 'dies', 'died', 'dying', 'dead']],
  ['vida', ['life', 'live', 'lives', 'living', 'lived']],
  ['vivir', ['life', 'live', 'lives', 'living', 'lived']],
  ['ira', ['anger', 'angry', 'wrath']],
  ['enoj', ['anger', 'angry', 'wrath', 'vexed']],
  ['enfad', ['anger', 'angry', 'wrath']],
  ['rabia', ['anger', 'angry', 'wrath']],
  ['miedo', ['fear', 'afraid', 'fearing', 'fears']],
  ['temor', ['fear', 'afraid', 'fearing', 'fears']],
  ['dolor', ['pain', 'pains', 'grief', 'grieved', 'sorrow']],
  ['placer', ['pleasure', 'pleasures', 'delight']],
  ['fama', ['fame', 'reputation', 'glory', 'praise', 'renown']],
  ['gloria', ['glory', 'fame', 'praise']],
  ['reputacion', ['reputation', 'fame', 'praise', 'opinion']],
  ['opinion', ['opinion', 'opinions', 'judgement', 'judgment']],
  ['juicio', ['judgement', 'judgment', 'opinion', 'opinions']],
  ['razon', ['reason', 'rational', 'reasoning', 'intelligence']],
  ['racional', ['rational', 'reason', 'reasoning']],
  ['naturaleza', ['nature', 'natural', 'naturally']],
  ['universo', ['universe', 'universal', 'cosmos', 'world']],
  ['mundo', ['world', 'universe', 'cosmos']],
  ['cosmos', ['cosmos', 'universe', 'world']],
  ['dios', ['god', 'gods', 'divinity', 'deity', 'divine']],
  ['divin', ['divinity', 'deity', 'divine', 'god', 'gods']],
  ['alma', ['soul', 'souls', 'spirit']],
  ['mente', ['mind', 'minds', 'thought', 'thoughts']],
  ['pensamiento', ['thought', 'thoughts', 'think', 'thinking', 'mind']],
  ['pensar', ['think', 'thinking', 'thought', 'thoughts']],
  ['virtud', ['virtue', 'virtues', 'good']],
  ['justicia', ['justice', 'just', 'unjust', 'injustice']],
  ['justo', ['just', 'justice', 'unjust']],
  ['injust', ['unjust', 'injustice', 'wrong', 'wrongs']],
  ['verdad', ['truth', 'true', 'truthful']],
  ['bondad', ['good', 'goodness', 'kind', 'kindness', 'benevolent']],
  ['bueno', ['good', 'goodness', 'kind']],
  ['malo', ['evil', 'bad', 'wrong', 'wicked']],
  ['maldad', ['evil', 'bad', 'wrong', 'wicked']],
  ['deber', ['duty', 'duties']],
  ['tiempo', ['time', 'times']],
  ['cambio', ['change', 'changes', 'changing', 'changed']],
  ['cambiar', ['change', 'changes', 'changing', 'changed']],
  ['obstacul', ['obstacle', 'obstacles', 'impediment', 'hindrance', 'hinder', 'hindered', 'obstruction']],
  ['impedimento', ['impediment', 'hindrance', 'hinder', 'obstacle']],
  ['estorbo', ['impediment', 'hindrance', 'hinder', 'obstacle']],
  ['hombre', ['man', 'men', 'mankind']],
  ['humano', ['human', 'man', 'men', 'mankind']],
  ['comunidad', ['community', 'social', 'society', 'state']],
  ['sociedad', ['society', 'social', 'community', 'state']],
  ['social', ['social', 'society', 'community']],
  ['ciudad', ['city', 'citizen', 'state', 'community']],
  ['cooper', ['co-operation', 'cooperation', 'co-operate', 'work together']],
  ['colabor', ['co-operation', 'cooperation', 'work together', 'together']],
  ['libertad', ['free', 'freedom', 'liberty']],
  ['libre', ['free', 'freedom', 'liberty']],
  ['feliz', ['happy', 'happiness', 'tranquil', 'tranquillity']],
  ['felicidad', ['happy', 'happiness', 'tranquillity']],
  ['tranquil', ['tranquil', 'tranquillity', 'calm', 'serenity']],
  ['calma', ['calm', 'tranquil', 'tranquillity']],
  ['serenidad', ['serene', 'serenity', 'calm', 'tranquillity']],
  ['sabio', ['wise', 'wisdom']],
  ['sabiduria', ['wisdom', 'wise']],
  ['padre', ['father', 'fathers']],
  ['madre', ['mother', 'mothers']],
  ['familia', ['family', 'kinsman', 'kinsmen', 'kin']],
  ['maestro', ['teacher', 'teachers', 'master', 'tutor', 'instruct']],
  ['aprender', ['learn', 'learned', 'learnt', 'taught']],
  ['amigo', ['friend', 'friends', 'friendship']],
  ['amistad', ['friendship', 'friend', 'friends']],
  ['envidia', ['envy', 'envious']],
  ['odio', ['hate', 'hatred', 'hating']],
  ['orgullo', ['pride', 'proud', 'arrogant', 'arrogance']],
  ['vanidad', ['vain', 'vanity', 'pride']],
  ['cuerpo', ['body', 'bodies', 'flesh']],
  ['carne', ['flesh', 'body']],
  ['enfermedad', ['disease', 'sickness', 'illness', 'ill']],
  ['salud', ['health', 'healthy']],
  ['riqueza', ['wealth', 'riches', 'money', 'rich']],
  ['dinero', ['money', 'wealth', 'riches']],
  ['trabajo', ['work', 'labour', 'toil']],
  ['recuerd', ['remember', 'remembrance', 'memory']],
  ['memoria', ['memory', 'remember', 'remembrance']],
  ['olvid', ['forget', 'forgotten', 'oblivion', 'forgetfulness']],
  ['hablar', ['speak', 'speaking', 'speech', 'say', 'said']],
  ['palabra', ['word', 'words', 'speech']],
  ['perdon', ['forgive', 'forgiveness', 'kindly']],
  ['amabil', ['kind', 'kindly', 'gentle', 'gentleness', 'benevolent']],
  ['benevol', ['benevolent', 'benevolence', 'kind', 'kindly']],
  ['emperador', ['emperor', 'prince', 'court']],
  ['corte', ['court', 'courts']],
  ['dormir', ['sleep', 'sleeping', 'asleep']],
  ['despertar', ['wake', 'waking', 'awake', 'rise', 'rising']],
  ['levantar', ['rise', 'rising', 'get up']],
  ['manana', ['morning']],
  ['noche', ['night', 'evening']],
  ['providencia', ['providence', 'provident']],
  ['destino', ['fate', 'destiny', 'fated']],
  ['azar', ['chance', 'fortune']],
  ['atomo', ['atom', 'atoms']],
  ['ley', ['law', 'laws']],
  ['principio', ['principle', 'principles', 'beginning']],
  ['placer', ['pleasure', 'pleasures']],
  ['esclav', ['slave', 'slaves', 'slavery']],
  ['guerra', ['war', 'wars']],
  ['peste', ['plague', 'pestilence']],
  ['nada', ['nothing']],
  ['resignaci', ['resign', 'resigned', 'resignation', 'acquiesce']],
  ['acept', ['accept', 'accepts', 'accepted', 'content', 'contented']],
  ['ocupacion', ['business', 'busy', 'occupation']],
  ['cielo', ['heaven', 'heavens', 'sky']],
  ['estrella', ['star', 'stars']],
  ['rio', ['river', 'stream']],
  ['hoja', ['leaf', 'leaves']],
  ['higo', ['fig', 'figs']],
  ['abeja', ['bee', 'bees']],
  ['perro', ['dog', 'dogs']],
  ['animal', ['animal', 'animals', 'beast', 'beasts']],
];

function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  for (const suffix of ['ing', 'ed', 'ly', 'es', 's']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) return w.slice(0, -suffix.length);
  }
  return w;
}

interface Concept {
  label: string;
  stems: ReadonlySet<string>;
}

export function queryConcepts(query: string): Concept[] {
  const tokens = fold(query).split(/[^a-z'-]+/).filter((token) => token.length >= 3 && !STOPWORDS.has(token));
  const concepts: Concept[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    const stems = new Set<string>([stem(token)]);
    for (const [prefix, english] of LEXICON) {
      if (token.startsWith(prefix)) for (const form of english) stems.add(stem(form));
    }
    concepts.push({ label: token, stems });
  }
  return concepts;
}

interface IndexedParagraph {
  book: number;
  paragraph: number;
  text: string;
  length: number;
  counts: Map<string, number>;
}

let indexCache: IndexedParagraph[] | undefined;

function buildIndex(): IndexedParagraph[] {
  if (indexCache) return indexCache;
  const index: IndexedParagraph[] = [];
  for (let book = 1; book <= BOOK_COUNT; book += 1) {
    MEDITATIONS_TEXT[book]!.forEach((text, i) => {
      const counts = new Map<string, number>();
      for (const match of text.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)) {
        const key = stem(match[0].replace(/’/g, "'"));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      index.push({ book, paragraph: i + 1, text, length: text.length, counts });
    });
  }
  indexCache = index;
  return index;
}

function snippetFor(text: string, stems: ReadonlySet<string>): string {
  let at = -1;
  for (const match of text.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)) {
    if (stems.has(stem(match[0].replace(/’/g, "'")))) { at = match.index ?? 0; break; }
  }
  if (at < 0) return text.slice(0, 200);
  let start = Math.max(0, at - 110);
  let end = Math.min(text.length, at + 160);
  while (start > 0 && text[start - 1] !== ' ') start -= 1;
  while (end < text.length && text[end] !== ' ') end += 1;
  return `${start > 0 ? '… ' : ''}${text.slice(start, end).trim()}${end < text.length ? ' …' : ''}`;
}

export interface SearchOptions {
  limit?: number;
  /** Restrict to one book. */
  book?: number;
}

export function searchMeditations(query: string, options: SearchOptions = {}): MeditationsHit[] {
  const concepts = queryConcepts(query);
  if (concepts.length === 0) return [];
  const limit = Math.min(10, Math.max(1, options.limit ?? 5));
  const foldedGlossTokens = concepts.map((concept) => concept.label).filter((label) => label.length >= 4);
  const hits: Array<MeditationsHit & { covered: number }> = [];

  for (const entry of buildIndex()) {
    if (options.book && entry.book !== options.book) continue;
    let covered = 0;
    let score = 0;
    const matchedStems = new Set<string>();
    for (const concept of concepts) {
      let count = 0;
      for (const stemValue of concept.stems) {
        const c = entry.counts.get(stemValue);
        if (c) { count += c; matchedStems.add(stemValue); }
      }
      if (count > 0) { covered += 1; score += 10 + Math.min(count, 3) * 2; }
    }
    if (covered === 0) continue;
    const keyPassage = getBookDigest(entry.book)?.keyPassages.find((candidate) => candidate.paragraph === entry.paragraph);
    const glossMatch = Boolean(keyPassage && foldedGlossTokens.some((token) => fold(keyPassage.gloss).includes(token)));
    if (glossMatch) score += 4;
    // Prefer focused paragraphs: a long paragraph needs more evidence to outrank a short one.
    score -= entry.length / 1500;
    hits.push({ book: entry.book, paragraph: entry.paragraph, score: Math.round(score * 100) / 100, snippet: snippetFor(entry.text, matchedStems), glossMatch, covered });
  }

  return hits
    .sort((a, b) => b.covered - a.covered || b.score - a.score || a.book - b.book || a.paragraph - b.paragraph)
    .slice(0, limit)
    .map(({ covered: _covered, ...hit }) => hit);
}

/** Every key passage of every digest, flattened. */
export function listKeyPassages(): Array<{ book: number; passage: KeyPassage }> {
  return MEDITATIONS_DIGESTS.flatMap((digest) => digest.keyPassages.map((passage) => ({ book: digest.book, passage })));
}

export { MEDITATIONS_DIGESTS };
