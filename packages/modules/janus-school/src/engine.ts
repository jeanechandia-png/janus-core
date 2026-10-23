import { FOUNDER_LESSONS, GLOSSARY } from './founder-content.js';
import { AGE_BAND_NOTES, ATTENTION_PRINCIPLES, EVIDENCE, KID_TECHNIQUES, PARENT_GUIDE } from './kids-content.js';
import type {
  AgeBand, CardState, Energy, EvidenceNote, GlossaryTerm, KidSessionPlan, KidTechnique, LearnerProgress, Lesson,
  QuizItem, SessionBlock, Track,
} from './types.js';

const DAY_MS = 86_400_000;

export const NO_DIAGNOSIS_NOTICE = 'Janus School enseña y propone estrategias; no diagnostica ni etiqueta. Cualquier valoración de atención o conducta corresponde a un profesional clínico.';

export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function newProgress(learnerId: string, track: Track, now: Date = new Date()): LearnerProgress {
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(learnerId)) throw new Error('learnerId is invalid');
  return { learnerId, track, completedLessons: [], cards: {}, answered: 0, correct: 0, updatedAt: now.toISOString() };
}

// ---------- Founder track ----------
export function listLessons(): readonly Lesson[] { return FOUNDER_LESSONS; }

export function getLesson(id: string): Lesson | undefined {
  const key = normalize(id);
  return FOUNDER_LESSONS.find((lesson) => lesson.id === id || normalize(lesson.title).includes(key) || String(lesson.unit) === key);
}

export function nextLesson(progress: LearnerProgress): Lesson | undefined {
  return FOUNDER_LESSONS.find((lesson) => !progress.completedLessons.includes(lesson.id));
}

export function completeLesson(progress: LearnerProgress, lessonId: string, now: Date = new Date()): LearnerProgress {
  const lesson = FOUNDER_LESSONS.find((item) => item.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
  if (progress.completedLessons.includes(lessonId)) return progress;
  const cards = { ...progress.cards };
  for (const termId of lesson.termIds) {
    const key = `term:${termId}`;
    if (!cards[key]) cards[key] = freshCard(now);
  }
  return { ...progress, completedLessons: [...progress.completedLessons, lessonId], cards, updatedAt: now.toISOString() };
}

export function renderLesson(lesson: Lesson): string {
  const terms = lesson.termIds.map((id) => GLOSSARY.find((term) => term.id === id)).filter((term): term is GlossaryTerm => Boolean(term));
  return [
    `📘 Unidad ${lesson.unit} · ${lesson.title} (${lesson.minutes} min)`,
    `🎯 Objetivo: ${lesson.objective}`,
    '💡 Ideas clave:',
    ...lesson.keyIdeas.map((idea) => `• ${idea}`),
    `🧩 Analogía: ${lesson.analogy}`,
    '🗣️ Preguntas para hacerle a un programador o ingeniero:',
    ...lesson.askTheExpert.map((question) => `• ${question}`),
    '📖 Vocabulario de la unidad:',
    ...terms.map((term) => `• ${term.term}: ${term.plain}`),
  ].join('\n');
}

export function lookupTerm(query: string): GlossaryTerm[] {
  const q = normalize(query);
  if (!q) return [];
  const scored = GLOSSARY.map((term) => {
    const names = [term.term, term.id, ...(term.aliases ?? [])].map(normalize);
    let score = 0;
    if (names.some((name) => name === q)) score = 3;
    else if (names.some((name) => name.includes(q) || q.includes(name))) score = 2;
    else if (normalize(term.plain).includes(q)) score = 1;
    return { term, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((entry) => entry.term);
}

export function renderTerm(term: GlossaryTerm): string {
  return `📖 ${term.term} — ${term.plain}\n🧩 Es como: ${term.analogy}`;
}

export function listGlossary(area?: string): readonly GlossaryTerm[] {
  return area ? GLOSSARY.filter((term) => term.area === normalize(area)) : GLOSSARY;
}

// ---------- Spaced repetition (SM-2 style) ----------
export function freshCard(now: Date): CardState {
  return { ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: now.toISOString(), lapses: 0 };
}

/** grade: 0 = blackout … 5 = perfect (SM-2 scale). */
export function reviewCard(card: CardState, grade: number, now: Date = new Date()): CardState {
  const g = Math.min(5, Math.max(0, Math.round(grade)));
  let { ease, intervalDays, repetitions, lapses } = card;
  if (g < 3) {
    repetitions = 0; intervalDays = 1; lapses += 1;
  } else {
    repetitions += 1;
    intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(intervalDays * ease));
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));
  return { ease: Math.round(ease * 100) / 100, intervalDays, repetitions, lapses, dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString() };
}

export function dueCards(progress: LearnerProgress, now: Date = new Date(), limit = 10): string[] {
  return Object.entries(progress.cards)
    .filter(([, card]) => Date.parse(card.dueAt) <= now.getTime())
    .sort((a, b) => Date.parse(a[1].dueAt) - Date.parse(b[1].dueAt))
    .slice(0, limit)
    .map(([key]) => key);
}

export function gradeCard(progress: LearnerProgress, cardKey: string, grade: number, now: Date = new Date()): LearnerProgress {
  const card = progress.cards[cardKey];
  if (!card) throw new Error(`Unknown card: ${cardKey}`);
  return { ...progress, cards: { ...progress.cards, [cardKey]: reviewCard(card, grade, now) }, updatedAt: now.toISOString() };
}

export function cardFront(cardKey: string): { front: string; back: string } | undefined {
  if (!cardKey.startsWith('term:')) return undefined;
  const term = GLOSSARY.find((item) => item.id === cardKey.slice(5));
  return term ? { front: `¿Qué es «${term.term}»?`, back: `${term.plain}\nEs como: ${term.analogy}` } : undefined;
}

// ---------- Quiz ----------
export function quizFor(lessonId: string): readonly QuizItem[] {
  return FOUNDER_LESSONS.find((lesson) => lesson.id === lessonId)?.checks ?? [];
}

export function checkAnswer(quizItemId: string, choice: number): { correct: boolean; why: string; answer: number } | undefined {
  for (const lesson of FOUNDER_LESSONS) {
    const item = lesson.checks.find((check) => check.id === quizItemId);
    if (item) return { correct: item.answer === choice, why: item.why, answer: item.answer };
  }
  return undefined;
}

export function recordAnswer(progress: LearnerProgress, correct: boolean, now: Date = new Date()): LearnerProgress {
  return { ...progress, answered: progress.answered + 1, correct: progress.correct + (correct ? 1 : 0), updatedAt: now.toISOString() };
}

// ---------- Kids track ----------
export function inferAgeBand(age: number | undefined): AgeBand | undefined {
  if (age === undefined || !Number.isFinite(age)) return undefined;
  if (age <= 7) return '5-7';
  if (age <= 10) return '8-10';
  return '11-13';
}

export function listTechniques(ageBand?: AgeBand): readonly KidTechnique[] {
  return ageBand ? KID_TECHNIQUES.filter((technique) => technique.ageBands.includes(ageBand)) : KID_TECHNIQUES;
}

export function evidenceFor(ids: readonly string[]): EvidenceNote[] {
  return EVIDENCE.filter((note) => ids.includes(note.id));
}

export function allEvidence(): readonly EvidenceNote[] { return EVIDENCE; }
export function attentionPrinciples(): readonly string[] { return ATTENTION_PRINCIPLES; }
export function parentGuide(): readonly string[] { return PARENT_GUIDE; }

function hash(seed: string | number | undefined): number {
  const text = String(seed ?? '0');
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Builds a short, movement-friendly practice session. Deterministic for a given seed. */
export function planKidSession(options: { minutes?: number; energy?: Energy; ageBand?: AgeBand; topic?: string; seed?: string | number } = {}): KidSessionPlan {
  const energy: Energy = options.energy ?? 'normal';
  const band = options.ageBand;
  const notes = AGE_BAND_NOTES[band ?? '8-10'];
  const total = Math.min(40, Math.max(8, Math.round(options.minutes ?? 15)));
  const focusBlock = energy === 'high' ? Math.max(4, notes.focusMinutes - 3) : energy === 'low' ? Math.max(4, notes.focusMinutes - 2) : notes.focusMinutes;

  const pool = listTechniques(band);
  const topic = options.topic ? normalize(options.topic) : '';
  const matching = topic ? pool.filter((t) => normalize(`${t.title} ${t.skill}`).includes(topic) || topic.split(' ').some((w) => w.length > 3 && normalize(`${t.title} ${t.skill}`).includes(w))) : [];
  const candidates = matching.length > 0 ? matching : pool;
  const seed = hash(options.seed);

  const blocks: SessionBlock[] = [];
  let used = 0;
  blocks.push({
    kind: 'move', minutes: notes.moveMinutes, title: 'Calentamiento en movimiento',
    instructions: energy === 'high'
      ? ['10 saltos, estirar los brazos arriba y soplar despacio tres veces.', 'Cuando suene la señal, siéntate: empezamos.']
      : ['Estira los brazos arriba, gira los hombros y respira hondo tres veces.'],
  });
  used += notes.moveMinutes;

  let index = 0;
  while (used + focusBlock <= total - 2) {
    const technique = candidates[(seed + index) % candidates.length]!;
    const minutes = Math.min(focusBlock, technique.minutes);
    blocks.push({ kind: 'focus', minutes, title: technique.title, instructions: [`Meta de este bloque: ${technique.skill}.`, ...technique.steps.slice(0, 3)] });
    used += minutes;
    index += 1;
    if (used + notes.moveMinutes + focusBlock <= total - 2) {
      blocks.push({ kind: 'break', minutes: notes.moveMinutes, title: 'Pausa activa', instructions: ['Levántate, bebe agua y haz un movimiento (saltar, bailar 30 segundos o dar una vuelta).', 'Vuelve cuando el temporizador te avise.'] });
      used += notes.moveMinutes;
    }
  }
  if (blocks.every((block) => block.kind !== 'focus')) {
    const technique = candidates[seed % candidates.length]!;
    blocks.push({ kind: 'focus', minutes: Math.min(focusBlock, technique.minutes), title: technique.title, instructions: [`Meta de este bloque: ${technique.skill}.`, ...technique.steps.slice(0, 3)] });
  }
  blocks.push({ kind: 'wrap', minutes: 2, title: 'Cierre feliz', instructions: ['Celebra lo que ha conseguido hoy, con un elogio concreto.', 'Pregunta: «¿qué fue lo más divertido?» y «¿qué quieres practicar mañana?».'] });

  const planNotes = [
    'Usa un temporizador visible y avisa antes de cambiar de actividad.',
    'Si hoy hay poca energía o frustración, acorta el bloque y cierra con algo que ya domine.',
    NO_DIAGNOSIS_NOTICE,
  ];
  if (!band) planNotes.unshift('No sé la edad o el curso de Kendra: dime su edad para ajustar los ejercicios (uso 8–10 años por defecto).');

  const childScript = '¡Hola! Hoy vamos a jugar con los números en equipo. Primero nos movemos un poco, luego hacemos retos cortos y entre medias descansamos. Si algo se hace difícil, lo hacemos más pequeño. ¿Lista?';
  return {
    totalMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
    ageBand: band ?? 'unspecified', energy, blocks, notes: planNotes, childScript,
  };
}

export function renderKidSession(plan: KidSessionPlan): string {
  const icon: Record<SessionBlock['kind'], string> = { move: '🤸', focus: '🎯', break: '💧', play: '🎲', wrap: '🌟' };
  return [
    `🧒 Sesión de ${plan.totalMinutes} min · energía ${plan.energy}`,
    ...plan.blocks.map((block) => `${icon[block.kind]} ${block.minutes} min · ${block.title}\n${block.instructions.map((line) => `   • ${line}`).join('\n')}`),
    '📝 Notas:',
    ...plan.notes.map((note) => `• ${note}`),
  ].join('\n');
}

export function renderTechnique(technique: KidTechnique): string {
  const ev = evidenceFor(technique.evidenceIds);
  return [
    `🧮 ${technique.title} (${technique.minutes} min) — ${technique.skill}`,
    `💡 ${technique.whyItHelps}`,
    ...technique.steps.map((step, index) => `${index + 1}. ${step}`),
    `🧰 Materiales: ${technique.materials.join(', ')}`,
    ...(technique.caution ? [`⚠️ ${technique.caution}`] : []),
    ...ev.map((note) => `📚 [${note.level}] ${note.claim} (${note.source})`),
  ].join('\n');
}
