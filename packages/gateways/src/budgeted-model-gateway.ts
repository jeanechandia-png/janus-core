import type { ModelGateway, ModelRequest, ModelResponse } from './contracts.js';

/**
 * Reusable LEGO piece: wraps ANY model provider adapter and enforces a
 * per-run call budget (from the adaptive effort policy). Provider-agnostic:
 * Janus Core decides the budget, the adapter stays replaceable.
 *
 * - Calls beyond the budget are refused BEFORE reaching the provider (no
 *   spend), with a typed error the runtime can turn into "raise effort" options.
 * - Token usage reported by providers is accumulated for audit/cost tracking.
 */
export class ModelBudgetExceededError extends Error {
  readonly code = 'model_budget_exceeded';
  constructor(readonly maxCalls: number) {
    super(`Model call budget exhausted for this effort level (${maxCalls} call(s))`);
  }
}

export interface ModelBudgetUsage {
  maxCalls: number;
  calls: number;
  refused: number;
  failures: number;
  tokens: Record<string, number>;
}

export class BudgetedModelGateway implements ModelGateway {
  private calls = 0;
  private refused = 0;
  private failures = 0;
  private readonly tokens: Record<string, number> = {};

  constructor(private readonly inner: ModelGateway, private readonly maxCalls: number) {
    if (!Number.isInteger(maxCalls) || maxCalls < 0) throw new Error('maxCalls must be a non-negative integer');
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    if (this.calls >= this.maxCalls) {
      this.refused += 1;
      throw new ModelBudgetExceededError(this.maxCalls);
    }
    this.calls += 1;
    try {
      const response = await this.inner.complete(request);
      for (const [key, value] of Object.entries(response.usage ?? {})) {
        if (typeof value === 'number' && Number.isFinite(value)) this.tokens[key] = (this.tokens[key] ?? 0) + value;
      }
      return response;
    } catch (error) {
      this.failures += 1;
      throw error;
    }
  }

  remaining(): number {
    return Math.max(0, this.maxCalls - this.calls);
  }

  usage(): ModelBudgetUsage {
    return { maxCalls: this.maxCalls, calls: this.calls, refused: this.refused, failures: this.failures, tokens: { ...this.tokens } };
  }
}
