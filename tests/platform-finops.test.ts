import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlatformFinOpsSnapshot } from '../packages/core/src/platform-finops.js';
import type { ProductHealthSnapshot, ProductOperationalRecord } from '../packages/core/src/business-operations.js';

const records: ProductOperationalRecord[] = [
  { id: 'elevenlabs', name: 'ElevenLabs', status: 'active',
    sources: [{kind:'api',ref:'elevenlabs',purpose:'usage'}],
    tags: ['finops:provider'] },
  { id: 'chatbox', name: 'ChatBox', status: 'active',
    sources: [{kind:'local_db',ref:'chatbox',purpose:'product'}],
    tags: ['product'] },
  { id: 'claude', name: 'Claude', status: 'active',
    sources: [{kind:'manual',ref:'none',purpose:'billing'}],
    tags: ['finops:provider'] },
];
const reads: ProductHealthSnapshot[] = [
  { productId:'elevenlabs',state:'healthy',observedAt:'2026-11-04T09:00:00Z',
    source:'ElevenLabs usage',metrics:{spentEur:6,dailySpendEur:2,creditsUsed:35,creditsLimit:100} },
  { productId:'elevenlabs',state:'degraded',observedAt:'2026-11-04T10:00:00Z',
    source:'ElevenLabs usage',metrics:{spentEur:7,dailySpendEur:3,creditsUsed:70,creditsLimit:100,budgetEur:20} },
  { productId:'elevenlabs',state:'degraded',observedAt:'2026-11-05T09:00:00Z',
    source:'ElevenLabs usage',metrics:{spentEur:9,dailySpendEur:2,creditsUsed:90,creditsLimit:100,budgetEur:20,plan:'Creator'} },
  { productId:'chatbox',state:'healthy',observedAt:'2026-11-05T09:00:00Z',
    source:'test',metrics:{spentEur:9000} },
];

test('FinOps solamente registra proveedores marcados y no duplica lecturas acumulativas', () => {
  const snapshot=buildPlatformFinOpsSnapshot(records,reads,'2026-11-05T10:00:00Z');
  assert.equal(snapshot.providers.length,2);
  const elevenlabs=snapshot.providers.find(p=>p.id==='elevenlabs');
  assert.equal(elevenlabs?.spentEur,9);
  assert.deepEqual(elevenlabs?.daily.map(p=>p.eur),[3,2]);
  assert.deepEqual(elevenlabs?.monthly.map(p=>p.eur),[9]);
  assert.equal(elevenlabs?.creditsUsed,90);
  assert.equal(elevenlabs?.plan,'Creator');
  assert.equal(elevenlabs?.source,'ElevenLabs usage');
});
test('FinOps distingue dato desconocido de coste cero y mantiene fuente por proveedor', () => {
  const result=buildPlatformFinOpsSnapshot(records,reads,'2026-11-05T10:00:00Z');
  const claude=result.providers.find(p=>p.id==='claude');
  assert.equal(claude?.spentEur,null);
  assert.equal(claude?.budgetEur,null);
  assert.equal(claude?.verifiedAt,null);
  assert.deepEqual(claude?.monthly,[]);
  assert.deepEqual(claude?.daily,[]);
});
test('FinOps no atribuye a un proveedor lecturas de otros productos', () => {
  const result=buildPlatformFinOpsSnapshot(records,reads,'2026-11-05T10:00:00Z');
  assert.equal(result.providers.some(p=>p.id==='chatbox'),false);
  assert.equal(result.providers.find(p=>p.id==='elevenlabs')?.spentEur,9);
});
