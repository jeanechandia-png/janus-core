import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import {
  NO_DIAGNOSIS_NOTICE, attentionPrinciples, cardFront, checkAnswer, completeLesson, dueCards, getLesson, gradeCard,
  inferAgeBand, listTechniques, lookupTerm, newProgress, nextLesson, normalize, parentGuide, planKidSession, quizFor,
  recordAnswer, renderKidSession, renderLesson, renderTechnique, renderTerm,
  type AgeBand, type Energy, type LearnerProgress,
} from '../../modules/janus-school/src/index.js';

/** Persistence port. Progress is minimal JSON (counts and card schedules). */
export interface SchoolProgressStore {
  load(learnerId: string): LearnerProgress | undefined;
  save(progress: LearnerProgress): void;
}

export class MemorySchoolProgressStore implements SchoolProgressStore {
  private readonly data = new Map<string, LearnerProgress>();
  load(learnerId: string) { return this.data.get(learnerId); }
  save(progress: LearnerProgress) { this.data.set(progress.learnerId, progress); }
}

/** Local JSON file with atomic replace. POR CONFIRMAR: migrate to the SQLite store (local-first memory) later. */
export class JsonFileSchoolProgressStore implements SchoolProgressStore {
  constructor(private readonly path: string) {}
  private readAll(): Record<string, LearnerProgress> {
    if (!existsSync(this.path)) return {};
    try { return JSON.parse(readFileSync(this.path, 'utf8')) as Record<string, LearnerProgress>; } catch { return {}; }
  }
  load(learnerId: string) { return this.readAll()[learnerId]; }
  save(progress: LearnerProgress) {
    const all = this.readAll();
    all[progress.learnerId] = progress;
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
    renameSync(tmp, this.path);
  }
}

const FOUNDER_ID = 'founder';
const KID_ACTIONS = new Set(['kids.session', 'kids.technique', 'progress.get']);
const ENERGIES: readonly Energy[] = ['low', 'normal', 'high'];

/**
 * Thin Janus adapter over the `janus-school` LEGO module. Read-mostly, local, offline, no secrets.
 * Child learners (anything other than the Founder) can only use the kids actions: no founder lessons or parent guide.
 */
export class JanusSchoolToolAdapter implements ToolAdapter {
  readonly name = 'janus-school';
  readonly capabilities: string[] = [
    'lesson.next', 'lesson.get', 'lesson.complete', 'glossary.lookup', 'review.next', 'review.grade',
    'quiz.get', 'quiz.answer', 'kids.session', 'kids.technique', 'kids.guide', 'progress.get',
  ];

  constructor(private readonly store: SchoolProgressStore = new MemorySchoolProgressStore(), private readonly now: () => Date = () => new Date()) {}

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Janus School action: ${request.action}` };
    const input = request.input;
    const learnerId = typeof input.learnerId === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(input.learnerId) ? input.learnerId : FOUNDER_ID;
    const isFounder = learnerId === FOUNDER_ID;
    if (!isFounder && !KID_ACTIONS.has(request.action)) {
      return { ok: false, error: 'Esta función no está disponible en el perfil infantil.' };
    }
    await onProgress({ phase: 'progress', message: 'Janus School: preparando', percent: 50 });
    const now = this.now();
    const progress = this.store.load(learnerId) ?? newProgress(learnerId, isFounder ? 'founder' : 'kids', now);
    const reply = (text: string, extra: Record<string, unknown> = {}): ToolResult => ({ ok: true, output: { reply: text, ...extra } });

    switch (request.action) {
      case 'lesson.next': {
        const lesson = nextLesson(progress);
        if (!lesson) return reply('🎓 Has completado todas las unidades. Puedo repasar con tarjetas o profundizar en un tema.');
        return reply(renderLesson(lesson), { lessonId: lesson.id });
      }
      case 'lesson.get': {
        const lesson = getLesson(String(input.lessonId ?? input.query ?? ''));
        return lesson ? reply(renderLesson(lesson), { lessonId: lesson.id }) : { ok: false, error: 'No encuentro esa unidad.' };
      }
      case 'lesson.complete': {
        const lessonId = String(input.lessonId ?? '');
        try {
          const next = completeLesson(progress, lessonId, now);
          this.store.save(next);
          return reply(`✅ Unidad completada. Tienes ${Object.keys(next.cards).length} tarjetas de vocabulario en repaso.`);
        } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
      }
      case 'glossary.lookup': {
        const matches = lookupTerm(String(input.query ?? ''));
        if (matches.length === 0) return reply('No tengo ese término en el glosario todavía. Dime cómo lo oíste y lo busco o lo añadimos.');
        return reply(matches.map(renderTerm).join('\n\n'), { termIds: matches.map((m) => m.id) });
      }
      case 'review.next': {
        const key = dueCards(progress, now, 1)[0];
        if (!key) return reply('🌿 No tienes tarjetas pendientes hoy. Buen trabajo.');
        const card = cardFront(key);
        return card ? reply(`🃏 ${card.front}\n(Piensa tu respuesta; luego dime «la sabía» o «no la sabía».)`, { cardKey: key }) : { ok: false, error: 'Tarjeta no disponible.' };
      }
      case 'review.grade': {
        const key = String(input.cardKey ?? dueCards(progress, now, 1)[0] ?? '');
        const grade = Number(input.grade ?? (input.known === false ? 1 : 4));
        try {
          const next = gradeCard(progress, key, grade, now);
          this.store.save(next);
          const card = cardFront(key);
          return reply(`${grade >= 3 ? '✅ Bien.' : '🔁 La repasaremos pronto.'}${card ? `\n${card.back}` : ''}`);
        } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
      }
      case 'quiz.get': {
        const lesson = getLesson(String(input.lessonId ?? '')) ?? nextLesson(progress);
        const items = lesson ? quizFor(lesson.id) : [];
        if (items.length === 0) return { ok: false, error: 'No hay cuestionario para esa unidad.' };
        return reply(items.map((item, i) => `❓ ${i + 1}. ${item.question}\n${item.options.map((o, j) => `   ${String.fromCharCode(65 + j)}) ${o}`).join('\n')}`).join('\n\n'), { quizItemIds: items.map((item) => item.id) });
      }
      case 'quiz.answer': {
        const choice = typeof input.choice === 'number' ? input.choice : String(input.choice ?? '').toUpperCase().charCodeAt(0) - 65;
        const result = checkAnswer(String(input.quizItemId ?? ''), choice);
        if (!result) return { ok: false, error: 'Pregunta desconocida.' };
        this.store.save(recordAnswer(progress, result.correct, now));
        return reply(`${result.correct ? '✅ ¡Correcto!' : '❌ No exactamente.'} ${result.why}`);
      }
      case 'kids.session': {
        const age = typeof input.age === 'number' ? input.age : undefined;
        const ageBand = (['5-7', '8-10', '11-13'] as const).includes(input.ageBand as AgeBand) ? (input.ageBand as AgeBand) : inferAgeBand(age);
        const energy = ENERGIES.includes(input.energy as Energy) ? (input.energy as Energy) : 'normal';
        const plan = planKidSession({
          ...(typeof input.minutes === 'number' ? { minutes: input.minutes } : {}),
          energy,
          ...(ageBand ? { ageBand } : {}),
          ...(typeof input.topic === 'string' ? { topic: input.topic } : {}),
          seed: `${learnerId}:${now.toISOString().slice(0, 10)}`,
        });
        return reply(renderKidSession(plan), { childScript: plan.childScript, totalMinutes: plan.totalMinutes });
      }
      case 'kids.technique': {
        const topic = normalize(String(input.topic ?? input.techniqueId ?? ''));
        const all = listTechniques();
        const found = all.find((t) => t.id === topic) ?? all.find((t) => normalize(`${t.title} ${t.skill}`).includes(topic)) ?? (topic.includes('abaco') ? all.find((t) => t.id.startsWith('abaco')) : undefined) ?? (topic.includes('chin') ? all.find((t) => t.id.includes('china')) : undefined);
        return found ? reply(renderTechnique(found), { techniqueId: found.id }) : reply(`Estas son las técnicas que tengo:\n${all.map((t) => `• ${t.title} — ${t.skill}`).join('\n')}`);
      }
      case 'kids.guide':
        return reply(['👨‍👧 Guía para acompañarla en casa', ...parentGuide().map((line) => `• ${line}`), '🎯 Principios de sesión:', ...attentionPrinciples().map((line) => `• ${line}`), NO_DIAGNOSIS_NOTICE].join('\n'));
      default: {
        return reply(`📊 Progreso: ${progress.completedLessons.length} unidades · ${Object.keys(progress.cards).length} tarjetas · ${progress.correct}/${progress.answered} aciertos.`);
      }
    }
  }
}
