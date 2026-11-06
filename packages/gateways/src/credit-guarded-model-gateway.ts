import { ModelBudgetExceededError } from './budgeted-model-gateway.js';
import type { ModelGateway, ModelRequest, ModelResponse } from './contracts.js';

/**
 * Single process-wide reservation ledger shared by ALL external model adapters.
 * Count attempts before sending them; even failed HTTP calls may incur credits.
 * This does not estimate euro charges, guarantee billing limits at the provider,
 * or persist across restarts. External provider spend is OFF unless enabled in
 * model-provider-config.ts with a positive explicit cap.
 */
export class ExternalCreditCallLedger {
  private attempted = 0;

  constructor(readonly maxCalls: number) {
    if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 100) {
      throw new Error('external credit call cap must be between 1 and 100');
    }
  }

  reserve(): void {
    if (this.attempted >= this.maxCalls) throw new ModelBudgetExceededError(this.maxCalls);
    this.attempted += 1;
  }

  usage(): Readonly<{ maxCalls: number; attempted: number; remaining: number }> {
    return Object.freeze({
      maxCalls: this.maxCalls,
      attempted: this.attempted,
      remaining: Math.max(0, this.maxCalls - this.attempted),
    });
  }
}

export class CreditGuardedModelGateway implements ModelGateway {
  constructor(
    private readonly delegate: ModelGateway,
    private readonly ledger: ExternalCreditCallLedger,
  ) {}

  complete(request: ModelRequest): Promise<ModelResponse> {
    this.ledger.reserve();
    return this.delegate.complete(request);
  }
}
