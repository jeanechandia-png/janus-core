import { BIOGRAPHY, DOCTRINE, EXERCISES, LIMITS, MODERN_PSYCHOLOGY, QUOTES, WORKS } from './corpus.js';
import type { MarcusExercise, MarcusGuidance, MarcusQuote, ProfileSection, StressTheme, VerificationStatus } from './types.js';

const THEME_PATTERNS: ReadonlyArray<readonly [StressTheme, RegExp]> = [
  ['future_worry', /futuro|que pasara|y si |preocup|ansied|angusti|miedo|temo|temor|nervios|anticip|incertidumbre|worry|anxious|anxiety|afraid|bezorgd|angst/],
  ['past_rumination', /pasado|arrepent|culpa|rumi|recuerd|no dejo de pensar|errores?|regret|spijt|schuld/],
  ['time_pressure', /tiempo|agenda|prisa|plazo|deadline|urgen|no llego|sin tiempo|time pressure|tijd|haast/],
  ['overwhelm', /estres|agobi|abrum|sobrecarg|burnout|quemad|saturad|overwhelm|stress|druk|uitgeput/],
  ['anger', /enojo|enfad|ira\b|rabia|furios|molest|frustr|anger|angry|boos|woede/],
  ['control_acceptance', /control|no depende|injust|imprevist|fuera de mi|aceptar|aceptacion|uncertain|accept/],
  ['adversity', /problema|crisis|perdida|fracaso|dificil|adversidad|setback|failure|ruina|quiebra|tegenslag/],
  ['self_review', /reflexion|examen|revisar el dia|balance del dia|diario|journal|reflect|humildad/],
  ['happiness', /feliz|felicidad|happy|happiness|tranquil|paz\b|calma|serenidad|gelukkig/],
  ['present_moment', /presente|mindful|atencion plena|aqui y ahora|here and now|present moment/],
];

const CRISIS_PATTERN = /suicid|quitarme la vida|quiero morir|quiero morirme|no quiero vivir|acabar con todo|hacerme dano|autolesion|matarme|kill myself|end my life|self.?harm|zelfmoord|niet meer leven|mezelf iets aandoen/;

const STATUS_LABEL: Record<VerificationStatus, string> = {
  'text-verified-long': 'texto contrastado en la traducción inglesa de G. Long; versión en español libre',
  'attributed-unlocated': 'frase atribuida a Marco Aurelio; no localicé el pasaje original, no la tomes como cita literal',
};

const STATUS_ORDER: Record<VerificationStatus, number> = { 'text-verified-long': 0, 'attributed-unlocated': 1 };

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

export function detectThemes(text: string): StressTheme[] {
  const normalized = normalizeText(text);
  return THEME_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([theme]) => theme);
}

export function mentionsCrisis(text: string): boolean {
  return CRISIS_PATTERN.test(normalizeText(text));
}

export function mentionsMarcusAurelius(text: string): boolean {
  return /marco aurelio|marcus aurelius|\bmeditaciones\b/.test(normalizeText(text));
}

export function listQuotes(filter: { theme?: StressTheme; status?: VerificationStatus } = {}): MarcusQuote[] {
  return QUOTES.filter((quote) => (!filter.theme || quote.themes.includes(filter.theme)) && (!filter.status || quote.status === filter.status));
}

export function getQuoteById(id: string): MarcusQuote | undefined {
  return QUOTES.find((quote) => quote.id === id);
}

export function formatQuote(quote: MarcusQuote, options: { includeEnglish?: boolean } = {}): string {
  const attribution = quote.locus ? `${quote.work} ${quote.locus}` : quote.work;
  const lines = [`«${quote.es}»`, `— Marco Aurelio · ${attribution} · ${STATUS_LABEL[quote.status]}`];
  if (options.includeEnglish && quote.en) lines.splice(1, 0, `   (${quote.en})`);
  if (quote.note) lines.push(`   Nota: ${quote.note}`);
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

export interface GuidanceOptions {
  seed?: string | number;
  maxQuotes?: number;
  includeEnglish?: boolean;
}

export function selectGuidance(text: string, options: GuidanceOptions = {}): MarcusGuidance {
  if (mentionsCrisis(text)) return supportFirstGuidance();

  let themes = detectThemes(text);
  if (themes.length === 0) themes = ['overwhelm', 'control_acceptance'];
  const seed = hashSeed(options.seed);
  const maxQuotes = Math.min(3, Math.max(1, options.maxQuotes ?? 2));

  const ranked = rank(QUOTES, themes, seed, (quote) => STATUS_ORDER[quote.status]);
  const picked = ranked.slice(0, maxQuotes);
  // Always anchor at least one verified passage next to an attributed one.
  if (picked.length > 0 && picked.every((quote) => quote.status === 'attributed-unlocated')) {
    const anchor = ranked.find((quote) => quote.status === 'text-verified-long');
    if (anchor) picked.push(anchor);
  }

  const exercise = rank(EXERCISES, themes, seed, () => 0)[0];
  const framing = framingFor(themes);
  const disclaimers = [LIMITS[0]!, LIMITS[2]!];
  if (picked.some((quote) => quote.status === 'attributed-unlocated')) {
    disclaimers.push('La frase «atribuida» circula como de Marco Aurelio, pero no he localizado el pasaje; la idea sí es coherente con Meditaciones 8.47.');
  }
  const base: Omit<MarcusGuidance, 'reply'> = { mode: 'stoic', themes, quotes: picked, ...(exercise ? { exercise } : {}), framing, disclaimers };
  return { ...base, reply: renderReply(base, options.includeEnglish === true) };
}

function framingFor(themes: readonly StressTheme[]): string[] {
  const lines: string[] = [];
  if (themes.includes('future_worry')) lines.push('Marco Aurelio insiste en que lo que nos inquieta es, a menudo, el juicio que añadimos a lo que podría ocurrir.');
  if (themes.includes('past_rumination')) lines.push('Lo ya ocurrido solo pide una cosa: aprender y corregir. Rumiarlo no lo cambia.');
  if (themes.includes('time_pressure')) lines.push('Ante la prisa, él recomienda hacer bien lo que tienes delante, una cosa cada vez.');
  if (themes.includes('overwhelm')) lines.push('Cuando todo pesa, conviene separar el hecho del juicio y quedarte con la siguiente acción posible.');
  if (themes.includes('anger')) lines.push('Para él, la mejor respuesta a la ofensa es no volverse como quien la comete.');
  if (themes.includes('control_acceptance') || themes.includes('adversity')) lines.push('Distingue lo que depende de ti de lo que no, y convierte el obstáculo en material de trabajo.');
  if (lines.length === 0) lines.push('Una idea sencilla de Marco Aurelio: el alma se tiñe con los pensamientos habituales; elígelos con cuidado.');
  return lines;
}

function renderReply(guidance: Omit<MarcusGuidance, 'reply'>, includeEnglish: boolean): string {
  const parts: string[] = [guidance.framing.join(' ')];
  parts.push(guidance.quotes.map((quote) => formatQuote(quote, { includeEnglish })).join('\n\n'));
  if (guidance.exercise) {
    const exercise = guidance.exercise;
    parts.push([
      `Ejercicio de ${exercise.minutes} min — ${exercise.title}:`,
      ...exercise.steps.map((step, index) => `${index + 1}. ${step}`),
      ...(exercise.caution ? [`Precaución: ${exercise.caution}`] : []),
    ].join('\n'));
  }
  parts.push(guidance.disclaimers.join(' '));
  return parts.join('\n\n');
}

export function supportFirstGuidance(): MarcusGuidance {
  const framing = [
    'Lo que cuentas importa más que cualquier cita. No quiero responderte con filosofía ahora.',
    'Si estás en peligro o piensas hacerte daño, contacta ahora con los servicios de emergencia de tu país o con una persona de confianza que pueda estar contigo.',
    'Y cuando puedas, habla con un profesional de salud: no tienes que cargar con esto solo.',
  ];
  return { mode: 'support_first', themes: [], quotes: [], framing, disclaimers: [LIMITS[1]!], reply: framing.join('\n\n') };
}

export function dailyReflection(date: Date = new Date()): MarcusGuidance {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  const verified = QUOTES.filter((quote) => quote.status === 'text-verified-long');
  const quote = verified[day % verified.length]!;
  const exercise = rank(EXERCISES, quote.themes, day, () => 0)[0] ?? EXERCISES[0]!;
  const base: Omit<MarcusGuidance, 'reply'> = { mode: 'stoic', themes: quote.themes, quotes: [quote], exercise, framing: ['Reflexión de hoy: una idea, una acción.'], disclaimers: [LIMITS[0]!, LIMITS[2]!] };
  return { ...base, reply: renderReply(base, false) };
}

export function getProfile(section: ProfileSection = 'overview'): { section: ProfileSection; title: string; text: string } {
  switch (section) {
    case 'life':
      return { section, title: 'Vida de Marco Aurelio', text: BIOGRAPHY.map((fact) => `• ${fact.period}: ${fact.text}`).join('\n') };
    case 'works':
      return { section, title: 'Obra de Marco Aurelio', text: WORKS.map((work) => `• ${work.title}: ${work.summary}${work.stressRelevance ? ` Útil para: ${work.stressRelevance}` : ''}`).join('\n') };
    case 'doctrine':
      return { section, title: 'Pensamiento de Marco Aurelio', text: DOCTRINE.map((point) => `• ${point.title}: ${point.text}`).join('\n') };
    case 'modern_psychology':
      return { section, title: 'Marco Aurelio y la psicología moderna', text: MODERN_PSYCHOLOGY.map((line) => `• ${line}`).join('\n') };
    case 'limits':
      return { section, title: 'Alcance y límites', text: LIMITS.map((line) => `• ${line}`).join('\n') };
    default:
      return {
        section: 'overview',
        title: 'Marco Aurelio en breve',
        text: [
          'Marco Aurelio (121–180 d. C.), emperador romano (161–180) y filósofo estoico. Gobernó en tiempos de guerra y de peste.',
          'Su obra, las Meditaciones, son notas personales en griego, escritas para sí mismo y no para publicarse.',
          'Ideas clave: el juicio, no el hecho, es lo que nos perturba; centrarse en lo que depende de uno; convertir el obstáculo en material; vivir con la conciencia de la finitud; humildad en el poder.',
          'Su vigencia: tiene paralelos con la terapia cognitivo-conductual, aunque no es un tratamiento clínico.',
        ].join('\n'),
      };
  }
}

export function listExercises(theme?: StressTheme): MarcusExercise[] {
  return EXERCISES.filter((exercise) => !theme || exercise.themes.includes(theme));
}
