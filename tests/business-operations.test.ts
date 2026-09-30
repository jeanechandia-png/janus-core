import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProductOperationsSnapshot,
  createProductLedgerEntry,
  createProductOperationalRecord,
  summarizeLedger,
} from '../packages/core/src/business-operations.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

test('business operations keeps currencies separate and calculates verified net balances', () => {
  const entries = [
    createProductLedgerEntry({
      id: 'e1',
      productId: 'tribuna-virtual',
      kind: 'income',
      amountMinor: 12500,
      currency: 'EUR',
      occurredAt: '2026-10-01T00:00:00.000Z',
      source: 'billing',
      verified: true,
    }),
    createProductLedgerEntry({
      id: 'e2',
      productId: 'tribuna-virtual',
      kind: 'fee',
      amountMinor: 500,
      currency: 'EUR',
      occurredAt: '2026-10-01T00:01:00.000Z',
      source: 'billing',
      verified: true,
    }),
    createProductLedgerEntry({
      id: 'e3',
      productId: 'tribuna-virtual',
      kind: 'income',
      amountMinor: 3000,
      currency: 'USD',
      occurredAt: '2026-10-01T00:02:00.000Z',
      source: 'billing',
      verified: false,
    }),
  ];

  const balances = summarizeLedger(entries);
  assert.deepEqual(balances.map((item) => item.currency), ['EUR', 'USD']);
  assert.equal(balances[0]?.netMinor, 12000);
  assert.equal(balances[0]?.verifiedEntries, 2);
  assert.equal(balances[1]?.netMinor, 3000);
  assert.equal(balances[1]?.unverifiedEntries, 1);
});

test('product operations snapshot combines health, finance and social evidence without inventing thresholds', () => {
  const product = createProductOperationalRecord({
    id: 'tribuna-virtual',
    name: 'Tribuna Virtual',
    status: 'active',
    sources: [
      {
        kind: 'api',
        ref: 'tribuna-runtime',
        purpose: 'health and product metrics',
      },
      {
        kind: 'accounting',
        ref: 'tribuna-ledger',
        purpose: 'income and expenses',
      },
    ],
  });

  const snapshot = buildProductOperationsSnapshot({
    product,
    generatedAt: '2026-10-01T00:05:00.000Z',
    ledgerEntries: [{
      id: 'income-1',
      productId: product.id,
      kind: 'income',
      amountMinor: 10000,
      currency: 'EUR',
      occurredAt: '2026-10-01T00:00:00.000Z',
      source: 'billing',
      verified: true,
    }],
    healthSnapshots: [{
      productId: product.id,
      state: 'healthy',
      observedAt: '2026-10-01T00:04:00.000Z',
      source: 'health-endpoint',
      metrics: { latencyMs: 120 },
    }],
    channelSnapshots: [{
      id: 'ig-1',
      platform: 'instagram',
      channelId: 'infinityseed',
      productId: product.id,
      verifiedAt: '2026-10-01T00:03:00.000Z',
      source: 'meta-api',
      metrics: { followers: 100 },
      monetizationState: 'building_eligibility',
    }],
    monetizationRequirements: [{
      id: 'ig-followers-1',
      platform: 'instagram',
      channelId: 'infinityseed',
      requirement: 'platform-reported eligibility requirement',
      currentValue: 100,
      state: 'not_met',
      verifiedAt: '2026-10-01T00:03:00.000Z',
      source: 'meta-api',
    }],
  });

  assert.equal(snapshot.financials[0]?.netMinor, 10000);
  assert.equal(snapshot.health?.state, 'healthy');
  assert.equal(snapshot.evidence.healthFresh, true);
  assert.equal(snapshot.channels.length, 1);
  assert.equal(snapshot.monetizationRequirements[0]?.targetValue, undefined);
});

test('SQLite persists product operations, ledger, health and social snapshots locally', () => {
  const store = new SqliteStore(':memory:');
  const product = createProductOperationalRecord({
    id: 'infinity-school',
    name: 'Infinity School',
    status: 'development',
    sources: [{ kind: 'local_db', ref: 'school-db', purpose: 'operational state' }],
  });
  store.upsertProductOperationalRecord(product);

  const ledger = createProductLedgerEntry({
    id: 'school-cost-1',
    productId: product.id,
    kind: 'expense',
    amountMinor: 2500,
    currency: 'EUR',
    occurredAt: '2026-10-01T00:00:00.000Z',
    source: 'manual-approved',
    verified: true,
  });
  store.appendProductLedgerEntry(ledger);
  store.appendProductHealthSnapshot({
    productId: product.id,
    state: 'unknown',
    observedAt: '2026-10-01T00:01:00.000Z',
    source: 'local',
  });
  store.upsertSocialChannelSnapshot({
    id: 'school-youtube-1',
    platform: 'youtube',
    channelId: 'school-channel',
    productId: product.id,
    verifiedAt: '2026-10-01T00:02:00.000Z',
    source: 'youtube-api',
    metrics: { subscribers: 0 },
    monetizationState: 'not_configured',
  });

  assert.equal(store.getProductOperationalRecord(product.id)?.name, 'Infinity School');
  assert.equal(store.listProductLedgerEntries(product.id)[0]?.amountMinor, 2500);
  assert.equal(store.listProductHealthSnapshots(product.id)[0]?.state, 'unknown');
  assert.equal(store.listSocialChannelSnapshots(product.id)[0]?.platform, 'youtube');
  store.close();
});
