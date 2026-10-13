import type { ModelGateway, ModelRequest, ModelResponse } from './contracts.js';
import { ModelBudgetExceededError } from './budgeted-model-gateway.js';

/**
 * Model Router (first productive version): Janus Core keeps an ordered list of
 * provider adapters (e.g. local, ChatGPT, Claude, Gemini) and continues with
 * the next one when a provider fails — continue-by-alternatives, never a
 * single-provider dead end. An effort-budget refusal is NOT a provider
 * failure and is never routed around.
 */
export interface RoutedProvider {
  id: string;
  gateway: ModelGateway;
}

export interface RouteAttempt {
  provider: string;
  ok: boolean;
  error?: string;
}

export class FallbackModelRouter implements ModelGateway {
  private attempts: RouteAttempt[] = [];

  constructor(private readonly providers: readonly RoutedProvider[]) {
    if (providers.length === 0) throw new Error('Model router needs at least one provider');
    const ids = new Set(providers.map((provider) => provider.id));
    if (ids.size !== providers.length) throw new Error('Model router provider ids must be unique');
  }

  providerIds(): string[] {
    return this.providers.map((provider) => provider.id);
  }

  lastAttempts(): RouteAttempt[] {
    return this.attempts.map((attempt) => ({ ...attempt }));
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    this.attempts = [];
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        const response = await provider.gateway.complete(request);
        this.attempts.push({ provider: provider.id, ok: true });
        return { ...response, provider: response.provider || provider.id };
      } catch (error) {
        if (error instanceof ModelBudgetExceededError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        this.attempts.push({ provider: provider.id, ok: false, error: message });
        errors.push(`${provider.id}: ${message}`);
      }
    }
    throw new Error('All model providers failed — ' + errors.join(' | '));
  }
}
