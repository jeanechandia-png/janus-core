import type {
  ToolAdapter,
  ToolProgress,
  ToolRequest,
  ToolResult,
} from '../../gateways/src/contracts.js';

export type StripeLedgerMode = 'test' | 'live';

export interface StripeLedgerAdapterOptions {
  mode: StripeLedgerMode;
  secretKey?: string;
  tokenProvider?: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  apiBase?: string;
}

type JsonRecord = Record<string, unknown>;

export class StripeLedgerAdapter implements ToolAdapter {
  readonly name = 'stripe-ledger';
  readonly capabilities = ['balance.transactions.list'];

  private readonly mode: StripeLedgerMode;
  private readonly secretKey?: string;
  private readonly tokenProvider?: () => Promise<string | undefined>;
  private readonly fetchImpl: typeof fetch;
  private readonly apiBase: string;

  constructor(options: StripeLedgerAdapterOptions) {
    this.mode = options.mode;
    this.secretKey = options.secretKey;
    this.tokenProvider = options.tokenProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiBase = (options.apiBase ?? 'https://api.stripe.com').replace(/\/$/, '');
  }

  async execute(
    request: ToolRequest,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) {
      return { ok: false, error: `Unsupported Stripe ledger action: ${request.action}` };
    }

    const token = (this.tokenProvider ? await this.tokenProvider() : this.secretKey)?.trim();
    if (!token) {
      return {
        ok: false,
        error: `Stripe ${this.mode} mode is not authenticated through the secure credential provider.`,
      };
    }

    const productId = requiredId(request.input.productId, 'productId');
    const aliases = aliasList(request.input.metadataAliases);
    const acceptedProductRefs = new Set([productId, ...aliases]);
    const limit = boundedInteger(request.input.limit, 100, 1, 100);

    const url = new URL(`${this.apiBase}/v1/balance_transactions`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.append('expand[]', 'data.source');

    const createdGte = timestampSeconds(request.input.since, 'since');
    const createdLte = timestampSeconds(request.input.until, 'until');
    if (createdGte != null) url.searchParams.set('created[gte]', String(createdGte));
    if (createdLte != null) url.searchParams.set('created[lte]', String(createdLte));

    const startingAfter = optionalId(request.input.startingAfter);
    if (startingAfter) url.searchParams.set('starting_after', startingAfter);

    await onProgress({
      phase: 'progress',
      message: `Stripe ${this.mode} ledger: reading balance transactions`,
      percent: 20,
      data: { productId, limit },
    });

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
        },
      });
    } catch (error) {
      return {
        ok: false,
        error: `Stripe network error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const body = await safeJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: stripeError(body, response.status),
      };
    }

    const transactions = Array.isArray(body.data) ? body.data.filter(isRecord) : [];
    const entries: JsonRecord[] = [];
    let matchedTransactions = 0;

    for (const transaction of transactions) {
      const normalized = normalizeBalanceTransaction(
        transaction,
        productId,
        acceptedProductRefs,
      );
      if (!normalized.matched) continue;
      matchedTransactions += 1;
      entries.push(...normalized.entries);
    }

    const lastTransaction = transactions.at(-1);
    const nextCursor = typeof lastTransaction?.id === 'string'
      ? lastTransaction.id
      : undefined;

    return {
      ok: true,
      output: {
        provider: 'stripe',
        mode: this.mode,
        productId,
        entries,
        scannedTransactions: transactions.length,
        matchedTransactions,
        hasMore: body.has_more === true,
        ...(nextCursor ? { nextCursor } : {}),
        verifiedAt: new Date().toISOString(),
      },
      externalReference: `stripe-balance-transactions-${this.mode}`,
    };
  }
}

function normalizeBalanceTransaction(
  transaction: JsonRecord,
  productId: string,
  acceptedProductRefs: ReadonlySet<string>,
): { matched: boolean; entries: JsonRecord[] } {
  const id = optionalId(transaction.id);
  const currency = typeof transaction.currency === 'string'
    ? transaction.currency.trim().toUpperCase()
    : '';
  const amount = integerNumber(transaction.amount);
  const fee = integerNumber(transaction.fee);
  const created = integerNumber(transaction.created);
  const type = typeof transaction.type === 'string' ? transaction.type.trim() : '';
  const source = isRecord(transaction.source) ? transaction.source : {};
  const metadata = isRecord(source.metadata) ? source.metadata : {};
  const sourceProductRef = firstString(
    metadata.janus_product_id,
    metadata.app,
    metadata.product_id,
  );

  if (
    !id
    || !/^[A-Z]{3}$/.test(currency)
    || amount == null
    || created == null
    || !sourceProductRef
    || !acceptedProductRefs.has(sourceProductRef)
  ) {
    return { matched: false, entries: [] };
  }

  const occurredAt = new Date(created * 1000).toISOString();
  if (occurredAt === 'Invalid Date') return { matched: false, entries: [] };

  const entries: JsonRecord[] = [];
  const sourceId = optionalId(source.id);
  const description = sourceId
    ? `Stripe ${type || 'balance transaction'} ${id} / source ${sourceId}`
    : `Stripe ${type || 'balance transaction'} ${id}`;

  if (isIncomeType(type) && amount > 0) {
    entries.push({
      id: `stripe:${id}:income`,
      productId,
      kind: 'income',
      amountMinor: amount,
      currency,
      occurredAt,
      source: 'stripe-balance-transaction',
      externalRef: id,
      description,
      verified: true,
    });
    if (fee != null && fee > 0) {
      entries.push({
        id: `stripe:${id}:fee`,
        productId,
        kind: 'fee',
        amountMinor: fee,
        currency,
        occurredAt,
        source: 'stripe-balance-transaction',
        externalRef: id,
        description: `Stripe fee associated with ${id}`,
        verified: true,
      });
    }
  } else if (isRefundType(type) && amount < 0) {
    entries.push({
      id: `stripe:${id}:refund`,
      productId,
      kind: 'refund',
      amountMinor: Math.abs(amount),
      currency,
      occurredAt,
      source: 'stripe-balance-transaction',
      externalRef: id,
      description,
      verified: true,
    });
    if (fee != null && fee > 0) {
      entries.push({
        id: `stripe:${id}:fee`,
        productId,
        kind: 'fee',
        amountMinor: fee,
        currency,
        occurredAt,
        source: 'stripe-balance-transaction',
        externalRef: id,
        description: `Stripe fee associated with refund ${id}`,
        verified: true,
      });
    }
  }

  return { matched: entries.length > 0, entries };
}

function isIncomeType(type: string): boolean {
  return type === 'charge' || type === 'payment';
}

function isRefundType(type: string): boolean {
  return type === 'refund' || type === 'payment_refund';
}

function aliasList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const id = optionalId(item);
    return id ? [id] : [];
  }))].slice(0, 25);
}

function requiredId(value: unknown, label: string): string {
  const id = optionalId(value);
  if (!id) throw new Error(`Stripe input '${label}' is required`);
  return id;
}

function optionalId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const id = value.trim();
  if (!id || id.length > 300 || !/^[A-Za-z0-9_.:-]+$/.test(id)) return undefined;
  return id;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = optionalId(value);
    if (result) return result;
  }
  return undefined;
}

function timestampSeconds(value: unknown, label: string): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value !== 'string') throw new Error(`Stripe input '${label}' must be ISO time or Unix seconds`);
  const parsed = Date.parse(value.trim());
  if (Number.isNaN(parsed)) throw new Error(`Stripe input '${label}' is invalid`);
  return Math.floor(parsed / 1000);
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function integerNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

async function safeJson(response: Response): Promise<JsonRecord> {
  try {
    const value: unknown = await response.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function stripeError(body: JsonRecord, status: number): string {
  const error = isRecord(body.error) ? body.error : {};
  const message = typeof error.message === 'string' ? error.message : undefined;
  const code = typeof error.code === 'string' ? ` code ${error.code}` : '';
  return message
    ? `Stripe API ${status}${code}: ${message}`
    : `Stripe API request failed with HTTP ${status}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
