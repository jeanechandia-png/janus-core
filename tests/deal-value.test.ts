import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateDealValue, validateDealEconomics, type DealEconomics } from '../packages/core/src/deal-value.js';
import { buildRadarView, createOpportunity, mergeOpportunity } from '../packages/core/src/opportunity-radar.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
const NOW = '2026-11-18T10:00:00Z';
const deal = (): DealEconomics => ({ priceCents: 1000, extraCostCents: 200, materialConditions: ['Recogida en la tienda indicada'], reference: { priceCents: 1500, sourceUrl: 'https://retailer.example/price', verifiedAt: '2026-11-18T09:00:00Z', validUntil: '2026-11-19T10:00:00Z', sameQuantity: true } });

test('B26: missing, stale, future, unverified or incomparable references never produce savings', () => {
  for (const d of [{ priceCents: 1000, materialConditions: [] }, { ...deal(), reference: { ...deal().reference!, sameQuantity: false } }, { ...deal(), reference: { ...deal().reference!, verifiedAt: '2026-11-18T11:00:00Z' } }, { ...deal(), reference: { ...deal().reference!, validUntil: NOW } }]) {
    const v = evaluateDealValue(d, true, NOW);
    assert.equal(v.status, 'reference_unconfirmed'); assert.equal(v.netSavingCents, null); assert.equal(v.percent, null);
  }
  assert.equal(evaluateDealValue(deal(), false, NOW).grossSavingCents, null);
});
test('B27: net savings subtract known material costs and do not invent unknown costs', () => {
  const v = evaluateDealValue(deal(), true, NOW);
  assert.equal(v.grossSavingCents, 500); assert.equal(v.netSavingCents, 300); assert.match(v.headline, /€3.00 netos/);
  assert.deepEqual(v.materialConditions, deal().materialConditions);
  assert.equal(evaluateDealValue({ ...deal(), extraCostCents: 600 }, true, NOW).status, 'no_saving');
  const unknown = evaluateDealValue({ ...deal(), extraCostCents: undefined }, true, NOW);
  assert.equal(unknown.netSavingCents, null); assert.match(unknown.headline, /bruto.*por confirmar/);
});
test('deal economics reject invalid money, credentials in URLs, bad dates and metadata smuggling', () => {
  for (const n of [-1, NaN, Infinity, 12.3, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateDealEconomics({ ...deal(), priceCents: n }));
  assert.throws(() => validateDealEconomics({ ...deal(), reference: { ...deal().reference!, sourceUrl: 'https://user:secret@retailer.example/' } }));
  assert.throws(() => validateDealEconomics({ ...deal(), reference: { ...deal().reference!, verifiedAt: 'yesterday' } }));
  const raw = { ...deal(), apiKey: 'must-not-persist', reference: { ...deal().reference!, account: 'private' } };
  const saved = validateDealEconomics(raw);
  assert.doesNotMatch(JSON.stringify(saved), /apiKey|must-not-persist|account/);
});
test('existing radar persists comparable economics and exposes value without claiming expired savings', () => {
  const store = new SqliteStore(':memory:');
  try {
    const o = createOpportunity({ provider: 'Retailer fixture', title: 'Comparable offer', verification: 'verified', sourceUrl: 'https://retailer.example/offer', economics: deal(), expiresAt: '2026-11-19T10:00:00Z' }, { id: 'deal-1', now: NOW });
    store.upsertRadarOpportunity(o);
    const reloaded = store.listRadarOpportunities();
    assert.equal(buildRadarView(reloaded, [], NOW).opportunities[0]?.value?.netSavingCents, 300);
    assert.equal(buildRadarView(reloaded, [], '2026-11-20T10:00:00Z').opportunities[0]?.value?.netSavingCents, null);
    const pending = createOpportunity({ provider: o.provider, title: o.title, economics: { ...deal(), priceCents: 1100 } }, { id: 'again', now: NOW });
    const merged = mergeOpportunity(o, pending, NOW);
    assert.equal(merged.opportunity.verification, 'pending'); assert.ok(merged.changed.includes('economics'));
    assert.equal(buildRadarView([merged.opportunity], [], NOW).opportunities[0]?.value?.netSavingCents, null);
    const terms = mergeOpportunity(o, { ...pending, economics: undefined, conditions: 'Membership now required' }, NOW);
    assert.equal(terms.opportunity.verification, 'pending', 'material conditions also invalidate the old savings verification');
    assert.equal(mergeOpportunity(o, { ...pending, economics: undefined }, NOW).opportunity.economics?.priceCents, 1000);
  } finally { store.close(); }
});
