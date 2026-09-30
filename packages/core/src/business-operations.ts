export type ProductLifecycleStatus =
  | 'active'
  | 'pilot'
  | 'development'
  | 'standby'
  | 'paused'
  | 'historical';

export type ProductDataSourceKind =
  | 'local_db'
  | 'api'
  | 'analytics'
  | 'accounting'
  | 'repository'
  | 'manual'
  | 'other';

export interface ProductDataSourceRef {
  kind: ProductDataSourceKind;
  ref: string;
  purpose: string;
  verifiedAt?: string;
}

export interface ProductOperationalRecord {
  id: string;
  name: string;
  status: ProductLifecycleStatus;
  supportSurfaceId?: string;
  sources: ProductDataSourceRef[];
  tags?: string[];
}

export type LedgerEntryKind = 'income' | 'expense' | 'refund' | 'fee' | 'tax';

export interface ProductLedgerEntry {
  id: string;
  productId: string;
  kind: LedgerEntryKind;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  source: string;
  externalRef?: string;
  description?: string;
  verified: boolean;
}

export type ProductHealthState = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ProductHealthSnapshot {
  productId: string;
  state: ProductHealthState;
  observedAt: string;
  source: string;
  metrics?: Record<string, number | string | boolean | null>;
}

export type SocialPlatform = 'facebook' | 'instagram' | 'youtube' | 'other';
export type MonetizationState =
  | 'not_configured'
  | 'building_eligibility'
  | 'eligible'
  | 'monetized'
  | 'restricted'
  | 'unknown';

export interface SocialChannelSnapshot {
  id: string;
  platform: SocialPlatform;
  channelId: string;
  productId?: string;
  verifiedAt: string;
  source: string;
  metrics: Record<string, number | string | boolean | null>;
  monetizationState: MonetizationState;
}

export interface MonetizationRequirementSnapshot {
  id: string;
  platform: SocialPlatform;
  channelId: string;
  requirement: string;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  state: 'met' | 'not_met' | 'unknown';
  verifiedAt: string;
  source: string;
}

export interface CurrencyBalance {
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  refundMinor: number;
  feeMinor: number;
  taxMinor: number;
  netMinor: number;
  verifiedEntries: number;
  unverifiedEntries: number;
}

export interface ProductOperationsSnapshot {
  product: ProductOperationalRecord;
  financials: CurrencyBalance[];
  health?: ProductHealthSnapshot;
  channels: SocialChannelSnapshot[];
  monetizationRequirements: MonetizationRequirementSnapshot[];
  generatedAt: string;
  evidence: {
    ledgerEntries: number;
    channelSnapshots: number;
    requirementSnapshots: number;
    healthFresh: boolean | null;
  };
}

export function createProductOperationalRecord(
  input: ProductOperationalRecord,
): ProductOperationalRecord {
  const id = safeId(input.id, 'product id');
  const name = requiredText(input.name, 'product name', 200);
  const sources = input.sources.map(validateSourceRef);
  return {
    ...input,
    id,
    name,
    sources,
    ...(input.supportSurfaceId
      ? { supportSurfaceId: safeId(input.supportSurfaceId, 'support surface id') }
      : {}),
    ...(input.tags ? { tags: cleanStrings(input.tags, 80) } : {}),
  };
}

export function createProductLedgerEntry(input: ProductLedgerEntry): ProductLedgerEntry {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
    throw new Error('ledger amountMinor must be a non-negative safe integer');
  }
  return {
    ...input,
    id: safeId(input.id, 'ledger id'),
    productId: safeId(input.productId, 'product id'),
    currency: normalizeCurrency(input.currency),
    occurredAt: validIso(input.occurredAt, 'ledger occurredAt'),
    source: requiredText(input.source, 'ledger source', 300),
    ...(input.externalRef
      ? { externalRef: requiredText(input.externalRef, 'ledger externalRef', 500) }
      : {}),
    ...(input.description
      ? { description: requiredText(input.description, 'ledger description', 1000) }
      : {}),
  };
}

export function buildProductOperationsSnapshot(input: {
  product: ProductOperationalRecord;
  ledgerEntries?: readonly ProductLedgerEntry[];
  healthSnapshots?: readonly ProductHealthSnapshot[];
  channelSnapshots?: readonly SocialChannelSnapshot[];
  monetizationRequirements?: readonly MonetizationRequirementSnapshot[];
  generatedAt?: string;
  healthFreshnessMs?: number;
}): ProductOperationsSnapshot {
  const product = createProductOperationalRecord(input.product);
  const generatedAt = validIso(input.generatedAt ?? new Date().toISOString(), 'generatedAt');

  const ledgerEntries = (input.ledgerEntries ?? [])
    .map(createProductLedgerEntry)
    .filter((entry) => entry.productId === product.id);
  const financials = summarizeLedger(ledgerEntries);

  const health = latestHealth(
    product.id,
    input.healthSnapshots ?? [],
  );
  const channels = (input.channelSnapshots ?? [])
    .filter((snapshot) => snapshot.productId === product.id)
    .map(validateChannelSnapshot)
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.id.localeCompare(b.id));

  const channelKeys = new Set(channels.map((item) => `${item.platform}\u0000${item.channelId}`));
  const monetizationRequirements = (input.monetizationRequirements ?? [])
    .map(validateRequirementSnapshot)
    .filter((item) => channelKeys.has(`${item.platform}\u0000${item.channelId}`))
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.requirement.localeCompare(b.requirement));

  const healthFreshnessMs = positiveInteger(input.healthFreshnessMs, 10 * 60_000);
  const generatedMs = Date.parse(generatedAt);
  const healthFresh = health
    ? generatedMs - Date.parse(health.observedAt) <= healthFreshnessMs
    : null;

  return {
    product,
    financials,
    ...(health ? { health } : {}),
    channels,
    monetizationRequirements,
    generatedAt,
    evidence: {
      ledgerEntries: ledgerEntries.length,
      channelSnapshots: channels.length,
      requirementSnapshots: monetizationRequirements.length,
      healthFresh,
    },
  };
}

export function summarizeLedger(entries: readonly ProductLedgerEntry[]): CurrencyBalance[] {
  const balances = new Map<string, CurrencyBalance>();

  for (const raw of entries) {
    const entry = createProductLedgerEntry(raw);
    const balance = balances.get(entry.currency) ?? {
      currency: entry.currency,
      incomeMinor: 0,
      expenseMinor: 0,
      refundMinor: 0,
      feeMinor: 0,
      taxMinor: 0,
      netMinor: 0,
      verifiedEntries: 0,
      unverifiedEntries: 0,
    };

    if (entry.kind === 'income') balance.incomeMinor += entry.amountMinor;
    if (entry.kind === 'expense') balance.expenseMinor += entry.amountMinor;
    if (entry.kind === 'refund') balance.refundMinor += entry.amountMinor;
    if (entry.kind === 'fee') balance.feeMinor += entry.amountMinor;
    if (entry.kind === 'tax') balance.taxMinor += entry.amountMinor;
    if (entry.verified) balance.verifiedEntries += 1;
    else balance.unverifiedEntries += 1;

    balance.netMinor = balance.incomeMinor
      - balance.expenseMinor
      - balance.refundMinor
      - balance.feeMinor
      - balance.taxMinor;
    balances.set(entry.currency, balance);
  }

  return [...balances.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

function latestHealth(
  productId: string,
  snapshots: readonly ProductHealthSnapshot[],
): ProductHealthSnapshot | undefined {
  return snapshots
    .filter((snapshot) => snapshot.productId === productId)
    .map(validateHealthSnapshot)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
}

function validateHealthSnapshot(input: ProductHealthSnapshot): ProductHealthSnapshot {
  return {
    ...input,
    productId: safeId(input.productId, 'product id'),
    observedAt: validIso(input.observedAt, 'health observedAt'),
    source: requiredText(input.source, 'health source', 300),
    ...(input.metrics ? { metrics: { ...input.metrics } } : {}),
  };
}

function validateChannelSnapshot(input: SocialChannelSnapshot): SocialChannelSnapshot {
  return {
    ...input,
    id: safeId(input.id, 'channel snapshot id'),
    channelId: requiredText(input.channelId, 'channel id', 300),
    ...(input.productId ? { productId: safeId(input.productId, 'product id') } : {}),
    verifiedAt: validIso(input.verifiedAt, 'channel verifiedAt'),
    source: requiredText(input.source, 'channel source', 500),
    metrics: { ...input.metrics },
  };
}

function validateRequirementSnapshot(
  input: MonetizationRequirementSnapshot,
): MonetizationRequirementSnapshot {
  if (
    input.currentValue != null
    && (!Number.isFinite(input.currentValue) || input.currentValue < 0)
  ) throw new Error('requirement currentValue must be a non-negative number');
  if (
    input.targetValue != null
    && (!Number.isFinite(input.targetValue) || input.targetValue < 0)
  ) throw new Error('requirement targetValue must be a non-negative number');

  return {
    ...input,
    id: safeId(input.id, 'requirement id'),
    channelId: requiredText(input.channelId, 'requirement channelId', 300),
    requirement: requiredText(input.requirement, 'requirement', 300),
    verifiedAt: validIso(input.verifiedAt, 'requirement verifiedAt'),
    source: requiredText(input.source, 'requirement source', 500),
    ...(input.unit ? { unit: requiredText(input.unit, 'requirement unit', 100) } : {}),
  };
}

function validateSourceRef(input: ProductDataSourceRef): ProductDataSourceRef {
  return {
    ...input,
    ref: requiredText(input.ref, 'source ref', 1000),
    purpose: requiredText(input.purpose, 'source purpose', 300),
    ...(input.verifiedAt
      ? { verifiedAt: validIso(input.verifiedAt, 'source verifiedAt') }
      : {}),
  };
}

function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency must be a 3-letter ISO code');
  return currency;
}

function safeId(value: string, label: string): string {
  const id = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(id)) {
    throw new Error(`${label} is invalid`);
  }
  return id;
}

function requiredText(value: string, label: string, maxLength: number): string {
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error(`${label} is invalid`);
  return text;
}

function validIso(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid`);
  return new Date(value).toISOString();
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function cleanStrings(values: readonly string[], maxLength: number): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .filter((value) => value.length <= maxLength);
}
