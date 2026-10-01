import assert from 'node:assert/strict';
import test from 'node:test';
import { StripeLedgerAdapter } from '../packages/adapters/src/stripe-ledger-adapter.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Stripe ledger adapter maps attributed charge balance evidence into income and fee entries', async () => {
  let observedUrl = '';
  let observedAuth = '';
  const adapter = new StripeLedgerAdapter({
    mode: 'test',
    secretKey: 'sk_test_secret',
    fetchImpl: async (input, init) => {
      observedUrl = String(input);
      observedAuth = String(
        (init?.headers as Record<string, string> | undefined)?.authorization ?? '',
      );
      return jsonResponse({
        data: [{
          id: 'txn_1',
          type: 'charge',
          amount: 3990,
          fee: 146,
          net: 3844,
          currency: 'eur',
          created: 1790812800,
          source: {
            id: 'ch_1',
            metadata: {
              janus_product_id: 'tribuna-virtual',
              app: 'la_tribuna_virtual',
            },
          },
        }],
        has_more: false,
      });
    },
  });

  const result = await adapter.execute({
    tool: 'stripe-ledger',
    action: 'balance.transactions.list',
    input: {
      productId: 'tribuna-virtual',
      metadataAliases: ['la_tribuna_virtual'],
      since: '2026-10-01T00:00:00.000Z',
      until: '2026-10-02T00:00:00.000Z',
    },
  }, async () => {});

  assert.equal(result.ok, true);
  assert.equal(observedAuth, 'Bearer sk_test_secret');
  assert.match(observedUrl, /v1\/balance_transactions/);
  assert.match(observedUrl, /expand%5B%5D=data.source/);
  assert.equal(JSON.stringify(result).includes('sk_test_secret'), false);
  assert.equal(result.output?.mode, 'test');
  assert.equal(result.output?.matchedTransactions, 1);
  assert.deepEqual(result.output?.entries, [
    {
      id: 'stripe:txn_1:income',
      productId: 'tribuna-virtual',
      kind: 'income',
      amountMinor: 3990,
      currency: 'EUR',
      occurredAt: '2026-10-01T00:00:00.000Z',
      source: 'stripe-balance-transaction',
      externalRef: 'txn_1',
      description: 'Stripe charge txn_1 / source ch_1',
      verified: true,
    },
    {
      id: 'stripe:txn_1:fee',
      productId: 'tribuna-virtual',
      kind: 'fee',
      amountMinor: 146,
      currency: 'EUR',
      occurredAt: '2026-10-01T00:00:00.000Z',
      source: 'stripe-balance-transaction',
      externalRef: 'txn_1',
      description: 'Stripe fee associated with txn_1',
      verified: true,
    },
  ]);
});

test('Stripe ledger adapter ignores transactions that are not attributed to the requested product', async () => {
  const adapter = new StripeLedgerAdapter({
    mode: 'test',
    secretKey: 'sk_test_secret',
    fetchImpl: async () => jsonResponse({
      data: [{
        id: 'txn_other',
        type: 'charge',
        amount: 1000,
        fee: 50,
        currency: 'eur',
        created: 1790812800,
        source: {
          id: 'ch_other',
          metadata: { janus_product_id: 'another-product' },
        },
      }],
      has_more: false,
    }),
  });

  const result = await adapter.execute({
    tool: 'stripe-ledger',
    action: 'balance.transactions.list',
    input: { productId: 'tribuna-virtual' },
  }, async () => {});

  assert.equal(result.ok, true);
  assert.equal(result.output?.matchedTransactions, 0);
  assert.deepEqual(result.output?.entries, []);
});

test('Stripe ledger adapter fails closed without the configured mode credential', async () => {
  const adapter = new StripeLedgerAdapter({ mode: 'live' });

  const result = await adapter.execute({
    tool: 'stripe-ledger',
    action: 'balance.transactions.list',
    input: { productId: 'tribuna-virtual' },
  }, async () => {});

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /live mode is not authenticated/);
});
