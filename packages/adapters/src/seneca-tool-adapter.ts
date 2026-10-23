import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import {
  dailyReflection, getProfile, listQuotes, selectGuidance, formatQuote,
  type ProfileSection, type StressTheme,
} from '../../modules/seneca-wisdom/src/index.js';

/**
 * Thin Janus adapter over the `seneca-wisdom` LEGO module. Read-only, local, no network, no secrets.
 * The module stays reusable in other products; Janus only wraps it as a Tool Gateway adapter.
 */
const SECTIONS: readonly ProfileSection[] = ['overview', 'life', 'works', 'doctrine', 'modern_psychology', 'limits'];
const THEMES: readonly StressTheme[] = ['future_worry', 'past_rumination', 'time_pressure', 'overwhelm', 'anger', 'control_acceptance', 'adversity', 'self_review', 'happiness', 'present_moment'];

export class SenecaToolAdapter implements ToolAdapter {
  readonly name = 'seneca';
  readonly capabilities: string[] = ['guidance.get', 'profile.get', 'quote.get', 'reflection.daily'];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Seneca action: ${request.action}` };
    const input = request.input;
    await onProgress({ phase: 'progress', message: 'Séneca: preparando respuesta', percent: 50 });

    if (request.action === 'guidance.get') {
      const text = typeof input.text === 'string' ? input.text.slice(0, 2000) : '';
      const seed = typeof input.seed === 'string' || typeof input.seed === 'number' ? input.seed : this.now().toISOString().slice(0, 10);
      const guidance = selectGuidance(text, { seed, includeLatin: input.includeLatin === true });
      return { ok: true, output: { mode: guidance.mode, themes: guidance.themes, reply: guidance.reply, quoteStatuses: guidance.quotes.map((q) => ({ id: q.id, status: q.status })) } };
    }

    if (request.action === 'profile.get') {
      const section = SECTIONS.includes(input.section as ProfileSection) ? (input.section as ProfileSection) : 'overview';
      const profile = getProfile(section);
      return { ok: true, output: { section: profile.section, title: profile.title, reply: `${profile.title}\n\n${profile.text}` } };
    }

    if (request.action === 'quote.get') {
      const theme = THEMES.includes(input.theme as StressTheme) ? (input.theme as StressTheme) : undefined;
      const pool = listQuotes(theme ? { theme } : {});
      if (pool.length === 0) return { ok: false, error: 'No Seneca quote matches that theme' };
      const day = Math.floor(this.now().getTime() / 86_400_000);
      const quote = pool[day % pool.length]!;
      return { ok: true, output: { quoteId: quote.id, status: quote.status, reply: formatQuote(quote, { includeLatin: input.includeLatin === true }) } };
    }

    const reflection = dailyReflection(this.now());
    return { ok: true, output: { mode: reflection.mode, reply: reflection.reply } };
  }
}
