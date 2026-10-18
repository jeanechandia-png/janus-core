import { DOCTRINE, BIOGRAPHY, EXERCISES, LIMITS, MODERN_PSYCHOLOGY, QUOTES, WORKS } from './corpus.js';
import type { ProfileSection, SenecaExercise, SenecaGuidance, SenecaQuote, StressTheme, VerificationStatus } from './types.js';

const THEME_PATTERNS: ReadonlyArray<readonly [StressTheme, RegExp]> = [
  ['future_worry', /futuro|que pasara|y si |preocup|ansied|angusti|miedo|temo|temor|nervios|anticip|incertidumbre|worry|anxious|anxiety|afraid|bezorgd|angst/],
  ['past_rumination', /pasado|arrepent|culpa|rumi|recuerd|no dejo de pensar|errores?|regret|spijt|schuld/],
  ['time_pressure', /tiempo|agenda|prisa|plazo|deadline|urgen|no llego|sin tiempo|time pressure|tijd|haast/],
  ['overwhelm', /estres|agobi|abrum|sobrecarg|burnout|quemad|saturad|overwhelm|stress|druk|uitgeput/],
  ['anger', /enojo|enfad|ira\b|rabia|furios|molest|frustr|anger|angry|boos|woede/],
  ['control_acceptance', /control|no depende|injust|imprevist|fuera de mi|aceptar|aceptacion|uncertain|accept/],
  ['adversity', /problema|crisis|perdida|fracaso|dificil|adversidad|setback|failure|ruina|quiebra|tegenslag/],
  ['self_review', /reflexion|examen|revisar el dia|balance del dia|diario|journal|reflect/],
  ['happiness', /feliz|felicidad|happy|happiness|tranquil|paz\b|calma|serenidad|gelukkig/],
  ['present_moment', /presente|mindful|atencion plena|aqui y ahora|here and now|present moment/],
];

const CRISIS_PATTERN = /suicid|quitarme la vida|quiero morir|quiero morirme|no quiero vivir|acabar con todo|hacerme dano|autolesion|matarme|kill myself|end my life|self.?harm|zelfmoord|niet meer leven|mezelf iets aandoen/;

const STATUS_LABEL: Record<VerificationStatus, string> = {
  'verified-primary': 'texto latino verificado en fuente primaria',
  'locus-unverified': 'sentencia clásica de Séneca; localización por confirmar',
  'attributed-unlocated': 'frase atribuida a Séneca; no localicé el pasaje original, no la tomes como cita literal',
};

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

export function detectThemes(text: string): StressTheme[] {
  const normalized = normalizeText(text);
  const found = THEME_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([theme]) => theme);
  return found;
}

export function mentionsCrisis(text: string): boolean {
  return CRISIS_PATTERN.test(normalizeText(text));
}

export function mentionsSeneca(text: string): boolean {
  return /\bsenec[ao]\b|estoic|stoic/.test(normalizeText(text));
}

export function listQuotes(filter: { theme?: StressTheme; status?: VerificationStatus } = {}): SenecaQuote[] {
  return QUOTES.filter((quote) => (!filter.theme || quote.themes.includes(filter.theme)) && (!filter.status || quote.status === filter.status));
}

export function getQuoteById(id: string): SenecaQuote | undefined {
  return QUOTES.find((quote) => quote.id === id);
}

export function formatQuote(quote: SenecaQuote, options: { includeLatin?: boolean } = {}): string {
  const attribution = quote.locus ? `${quote.work}, ${quote.locus}` : quote.work;
  const lines = [`«${quote.es}»`, `— Séneca · ${attribution} · ${STATUS_LABEL[quote.status]}`];
  if (options.includeLatin && quote.latin) lines.splice(1, 0, `   (${quote.latin})`);
  return lines.join('\n');
}

function hashSeed(seed: string | number | undefined): number {
  const text = String(seed ?? '0');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rank<T extends { themes: readonly StressTheme[] }>(items: readonly T[], themes: readonly StressTheme[], seed: number, statusOf: (item: T) => number): T[] {
  return [...items]
    .map((item, index) => ({ item, score: item.themes.filter((theme) => themes.includes(theme)).length, tie: (index * 2654435761 + seed) >>> 0 }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || statusOf(a.item) - statusOf(b.item) || a.tie - b.tie)
    .map((entry) => entry.item);
}

const STATUS_ORDER: Record<VerificationStatus, number> = { 'verified-primary': 0, 'locus-unverified': 1, 'attributed-unlocated': 2 };

export interface GuidanceOptions {
  /** Deterministic rotation among equally good matches. */
  seed?: string | number;
  maxQuotes?: number;
  includeLatin?: boolean;
}

export function selectGuidance(text: string, options: GuidanceOptions = {}): SenecaGuidance {
  if (mentionsCrisis(text)) return supportFirstGuidance();

  let themes = detectThemes(text);
  if (themes.length === 0) themes = ['overwhelm', 'future_worry'];
  const seed = hashSeed(options.seed);
  const maxQuotes = Math.min(3, Math.max(1, options.maxQuotes ?? 2));

  const ranked = rank(QUOTES, themes, seed, (quote) => STATUS_ORDER[quote.status]);
  const wantsHappiness = themes.includes('happiness') || (themes.includes('future_worry') && themes.includes('past_rumination'));
  const featured = wantsHappiness ? getQuoteById('attributed-two-burdens') : undefined;
  const picked: SenecaQuote[] = [];
  if (featured) picked.push(featured);
  for (const quote of ranked) {
    if (picked.length >= maxQuotes) break;
    if (!picked.includes(quote)) picked.push(quote);
  }
  // Always anchor at least one verified passage next to an attributed one.
  if (picked.every((quote) => quote.status === 'attributed-unlocated')) {
    const anchor = ranked.find((quote) => quote.status === 'verified-primary');
    if (anchor) picked.push(anchor);
  }

  const exercise = rank(EXERCISES, themes, seed, () => 0)[0];
  const framing = framingFor(themes);
  const disclaimers = [LIMITS[0]!];
  if (picked.some((quote) => quote.status === 'attributed-unlocated')) {
    disclaimers.push('La frase «atribuida» circula como de Séneca, pero no he localizado el pasaje en sus obras; la idea sí es coherente con Ep. 5.7–9 y 13.4–5.');
  }
  const guidance: Omit<SenecaGuidance, 'reply'> = { mode: 'stoic', themes, quotes: picked, ...(exercise ? { exercise } : {}), framing, disclaimers };
  return { ...guidance, reply: renderReply(guidance, options.includeLatin === true) };
}

function framingFor(themes: readonly StressTheme[]): string[] {
  const lines: string[] = [];
  if (themes.includes('future_worry')) lines.push('Gran parte de lo que nos pesa es anticipación: Séneca separa lo que ya ocurre de lo que imaginamos que ocurrirá.');
  if (themes.includes('past_rumination')) lines.push('Revivir el pasado multiplica el daño: lo útil de un error es la corrección, no la repetición.');
  if (themes.includes('time_pressure')) lines.push('Para Séneca el tiempo es lo único propio; la presión baja cuando se decide qué merece ese tiempo.');
  if (themes.includes('overwhelm')) lines.push('Cuando todo parece urgente, conviene reducir el problema a lo que de verdad depende de ti hoy.');
  if (themes.includes('anger')) lines.push('El estoicismo trata la ira como un juicio al que podemos no dar asentimiento; el examen nocturno ayuda a prevenirla.');
  if (themes.includes('control_acceptance') || themes.includes('adversity')) lines.push('Preparar una respuesta a lo adverso y luego soltarlo es más útil que rumiarlo.');
  if (lines.length === 0) lines.push('Una idea sencilla de Séneca: practicar poco y a menudo vale más que entender mucho.');
  return lines;
}

function renderReply(guidance: Omit<SenecaGuidance, 'reply'>, includeLatin: boolean): string {
  const parts: string[] = [];
  parts.push(guidance.framing.join(' '));
  parts.push(guidance.quotes.map((quote) => formatQuote(quote, { includeLatin })).join('\n\n'));
  if (guidance.exercise) {
    const exercise = guidance.exercise;
    parts.push([`Ejercicio de ${exercise.minutes} min — ${exercise.title}:`, ...exercise.steps.map((step, index) => `${index + 1}. ${step}`), exercise.caution ? `Precaución: ${exercise.caution}` : ''].filter(Boolean).join('\n'));
  }
  parts.push(guidance.disclaimers.join(' '));
  return parts.join('\n\n');
}

export function supportFirstGuidance(): SenecaGuidance {
  const framing = [
    'Lo que cuentas importa más que cualquier cita. No quiero responderte con filosofía ahora.',
    'Si estás en peligro o piensas hacerte daño, contacta ahora con los servicios de emergencia de tu país o con una persona de confianza que pueda estar contigo.',
    'Y cuando puedas, habla con un profesional de salud: no tienes que cargar con esto solo.',
  ];
  return { mode: 'support_first', themes: [], quotes: [], framing, disclaimers: [LIMITS[1]!, LIMITS[2]!], reply: framing.join('\n\n') };
}

export function dailyReflection(date: Date = new Date()): SenecaGuidance {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  const verified = QUOTES.filter((quote) => quote.status === 'verified-primary');
  const quote = verified[day % verified.length]!;
  const exercise = rank(EXERCISES, quote.themes, day, () => 0)[0] ?? EXERCISES[0]!;
  const framing = ['Reflexión de hoy: una idea, una acción.'];
  const disclaimers = [LIMITS[0]!];
  const base: Omit<SenecaGuidance, 'reply'> = { mode: 'stoic', themes: quote.themes, quotes: [quote], exercise, framing, disclaimers };
  return { ...base, reply: renderReply(base, false) };
}

export function getProfile(section: ProfileSection = 'overview'): { section: ProfileSection; title: string; text: string } {
  switch (section) {
    case 'life':
      return { section, title: 'Vida de Séneca', text: BIOGRAPHY.map((fact) => `• ${fact.period}: ${fact.text}`).join('\n') };
    case 'works':
      return { section, title: 'Obra de Séneca', text: WORKS.map((work) => `• ${work.title} (${work.latinTitle}): ${work.summary}${work.stressRelevance ? ` Útil para: ${work.stressRelevance}` : ''}`).join('\n') };
    case 'doctrine':
      return { section, title: 'Pensamiento de Séneca', text: DOCTRINE.map((point) => `• ${point.title}: ${point.text}`).join('\n') };
    case 'modern_psychology':
      return { section, title: 'Séneca y la psicología moderna', text: MODERN_PSYCHOLOGY.map((line) => `• ${line}`).join('\n') };
    case 'limits':
      return { section, title: 'Alcance y límites', text: LIMITS.map((line) => `• ${line}`).join('\n') };
    default:
      return {
        section: 'overview',
        title: 'Séneca en breve',
        text: [
          'Lucio Anneo Séneca (c. 4 a. C.–65 d. C.), nacido en Córdoba, filósofo estoico, escritor, consejero y tutor de Nerón, desterrado a Córcega y obligado a morir por orden imperial.',
          'Su obra más práctica contra el estrés son las Cartas a Lucilio (Ep. 1, 5, 13, 91), De brevitate vitae, De tranquillitate animi y De ira.',
          'Ideas clave: sufrimos más por la opinión que por la realidad; esperanza y miedo van juntos; el tiempo es lo único propio; prepararse sin angustiarse; examinar el día.',
          'Su vigencia: tiene paralelos con la terapia cognitivo-conductual, aunque no es un tratamiento clínico.',
        ].join('\n'),
      };
  }
}

export function listExercises(theme?: StressTheme): SenecaExercise[] {
  return EXERCISES.filter((exercise) => !theme || exercise.themes.includes(theme));
}
