import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import {
  askStoicism, bookAnswer, doctrineAnswer, figureAnswer, glossaryAnswer, historyAnswer, limitsAnswer, originsAnswer, overviewAnswer,
  passageAnswer, practiceAnswer, psychologyAnswer, searchAnswer, supportFirstAnswer, timelineAnswer, mentionsCrisis,
  type StoicismAnswer,
} from '../../modules/stoicism-knowledge/src/index.js';

/**
 * Thin Janus adapter over the `stoicism-knowledge` LEGO module (deep, personal-use Stoicism knowledge: the twelve books of the
 * Meditations in full, history, Greco-Roman origins, doctrine, psychology, practices). Read-only, local, no network, no secrets.
 * Deliberately NOT in the household-safe tool list: it is the founder's personal/work knowledge tool.
 */
const ACTIONS = [
  'ask', 'overview.get', 'book.get', 'passage.get', 'search.run', 'figure.get', 'history.get', 'timeline.get',
  'origins.get', 'doctrine.get', 'psychology.get', 'practice.get', 'glossary.get', 'limits.get',
] as const;

type Action = (typeof ACTIONS)[number];

function text(value: unknown, max = 600): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function integer(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isInteger(number) ? number : undefined;
}

export class StoicismToolAdapter implements ToolAdapter {
  readonly name = 'stoicism';
  readonly capabilities: string[] = [...ACTIONS];

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported stoicism action: ${request.action}` };
    const action = request.action as Action;
    const input = request.input ?? {};
    await onProgress({ phase: 'progress', message: 'Estoicismo: consultando el conocimiento', percent: 50 });

    // Free-text inputs get the same crisis gate as the sibling tools: support first, no philosophy.
    const freeText = `${text(input.text, 2000)} ${text(input.query)} ${text(input.topic)} ${text(input.name)}`;
    if (mentionsCrisis(freeText)) return this.ok(supportFirstAnswer());

    let result: StoicismAnswer;
    switch (action) {
      case 'ask':
        result = askStoicism(text(input.text, 2000), { offset: Math.max(0, integer(input.offset) ?? 0) });
        break;
      case 'overview.get':
        result = overviewAnswer();
        break;
      case 'book.get': {
        const book = integer(input.book);
        if (book === undefined) return { ok: false, error: 'book.get needs an integer "book" between 1 and 12' };
        result = bookAnswer(book, input.section === 'passages' ? 'passages' : 'summary');
        break;
      }
      case 'passage.get': {
        const book = integer(input.book);
        const paragraph = integer(input.paragraph);
        if (book === undefined || paragraph === undefined) return { ok: false, error: 'passage.get needs integer "book" and "paragraph"' };
        result = passageAnswer(book, paragraph, Math.max(0, integer(input.offset) ?? 0));
        break;
      }
      case 'search.run': {
        const query = text(input.query, 300).trim();
        if (!query) return { ok: false, error: 'search.run needs a non-empty "query"' };
        result = searchAnswer(query);
        break;
      }
      case 'figure.get': {
        const name = text(input.name).trim();
        if (!name) return { ok: false, error: 'figure.get needs a "name"' };
        result = figureAnswer(name);
        break;
      }
      case 'history.get':
        result = historyAnswer();
        break;
      case 'timeline.get':
        result = timelineAnswer();
        break;
      case 'origins.get':
        result = originsAnswer(text(input.topic));
        break;
      case 'doctrine.get':
        result = doctrineAnswer(text(input.topic));
        break;
      case 'psychology.get':
        result = psychologyAnswer(text(input.topic));
        break;
      case 'practice.get':
        result = practiceAnswer(text(input.topic));
        break;
      case 'glossary.get':
        result = glossaryAnswer(text(input.term));
        break;
      default:
        result = limitsAnswer();
    }
    return this.ok(result);
  }

  private ok(answer: StoicismAnswer): ToolResult {
    return { ok: true, output: { mode: answer.mode, topic: answer.topic, bases: answer.bases, reply: answer.reply } };
  }
}
