import type { ModelGateway, ModelRequest, ModelResponse } from '../../gateways/src/contracts.js';

/**
 * Native Claude (Anthropic Messages API) adapter.
 * Verified 2026-10-14 against platform.claude.com/docs/en/api/overview:
 * POST {base}/v1/messages, headers `x-api-key`, `anthropic-version: 2023-06-01`,
 * `content-type: application/json`. Replaceable like any other model adapter.
 */
export interface AnthropicMessagesModelAdapterOptions {
  model: string;
  baseUrl?: string;
  apiKey?: string;
  tokenProvider?: () => Promise<string | undefined>;
  anthropicVersion?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

type JsonRecord = Record<string, unknown>;

export class AnthropicMessagesModelAdapter implements ModelGateway {
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly tokenProvider?: () => Promise<string | undefined>;
  private readonly anthropicVersion: string;
  private readonly maxTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnthropicMessagesModelAdapterOptions) {
    const model = options.model.trim();
    if (!model) throw new Error('Claude model name is required');
    this.model = model;
    this.baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').trim().replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.tokenProvider = options.tokenProvider;
    this.anthropicVersion = options.anthropicVersion?.trim() || '2023-06-01';
    this.maxTokens = options.maxTokens ?? 4096;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const key = (this.tokenProvider ? await this.tokenProvider() : this.apiKey)?.trim();
    if (!key) throw new Error('Claude is not authenticated; provide the API key through the secure credential provider.');

    const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const message of request.messages) {
      if (message.role === 'system') continue;
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const last = messages[messages.length - 1];
      // The Messages API expects alternating turns; merge consecutive same-role turns.
      if (last && last.role === role) last.content += '\n\n' + message.content;
      else messages.push({ role, content: message.content });
    }
    if (messages.length === 0 || messages[0]!.role !== 'user') messages.unshift({ role: 'user', content: '(continue)' });
    if (request.responseFormat === 'json') {
      const last = messages[messages.length - 1]!;
      if (last.role === 'user') last.content += '\n\nRespond with a single valid JSON object only.';
    }

    const body: JsonRecord = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages,
      temperature: request.temperature ?? 0,
      ...(system ? { system } : {}),
    };
    const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': this.anthropicVersion,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    let payload: JsonRecord = {};
    try {
      const value: unknown = await response.json();
      if (value && typeof value === 'object' && !Array.isArray(value)) payload = value as JsonRecord;
    } catch { /* keep empty */ }
    if (!response.ok) {
      const error = payload.error && typeof payload.error === 'object' ? payload.error as JsonRecord : {};
      throw new Error(typeof error.message === 'string' ? `Claude HTTP ${response.status}: ${error.message}` : `Claude request failed with HTTP ${response.status}`);
    }
    const blocks = Array.isArray(payload.content) ? payload.content : [];
    const text = blocks
      .filter((block): block is JsonRecord => Boolean(block) && typeof block === 'object' && (block as JsonRecord).type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('');
    if (!text) throw new Error('Claude response did not contain text content');
    const usage: Record<string, number> = {};
    if (payload.usage && typeof payload.usage === 'object') {
      for (const [key2, value] of Object.entries(payload.usage as JsonRecord)) {
        if (typeof value === 'number' && Number.isFinite(value)) usage[key2] = value;
      }
    }
    return {
      text,
      model: typeof payload.model === 'string' ? payload.model : this.model,
      provider: 'anthropic',
      ...(Object.keys(usage).length ? { usage } : {}),
    };
  }
}
