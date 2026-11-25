import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Browser ESM component without a declaration file.
import { describeApproval } from '../apps/pwa/approval-chip.js';

const text = (path: string) => readFileSync(path, 'utf8');

test('el aviso de aprobación dice qué se hará, dónde, por qué, con qué riesgo y cuándo caduca', () => {
  const now = Date.parse('2026-11-11T10:00:00Z');
  const line = describeApproval({ operation: 'tienda.deleteOrder', target: 'tienda.example', reason: 'método DELETE', risk: 'critical', reversible: false, expiresAt: '2026-11-11T10:12:00Z' }, now);
  assert.equal(line, 'tienda.deleteOrder · en tienda.example · método DELETE · riesgo crítico · irreversible · caduca en 12 min');
  assert.match(describeApproval({ risk: 'high', expiresAt: '2026-11-11T09:00:00Z' }, now), /riesgo alto · caduca en 0 min/);
});

test('el botón vive en la capa de acceso, usa la cola existente y no escribe HTML', () => {
  const chip = text('apps/pwa/approval-chip.js');
  assert.ok(!chip.includes('innerHTML'));
  assert.match(chip, /\/api\/approvals/); assert.match(chip, /\/decision/);
  assert.ok(text('apps/pwa/dashboard-access.js').includes('mountApprovalChip()'));
  assert.ok(text('apps/pwa/sw.js').includes("'/approval-chip.js'"));
  for (const file of ['Janus-Core-A-public-safe.html', 'Janus-Core-B-public-safe.html']) assert.ok(!text('prototypes/dashboard/dist/' + file).includes('janus-approvals'));
});

test('Founder runtime opens the same approval queue and does not show a false zero', () => {
  const chip = text('apps/pwa/approval-chip.js');
  assert.match(chip,/verified \? String\(pending.length\) : '—'/);
  assert.match(chip,/function open\(\)/);
  assert.match(chip,/token!==sessionToken\(\)/);
  const access=text('apps/pwa/dashboard-access.js');
  assert.match(access,/data-live-approvals/);
  assert.match(access,/approvals.open\(\)/);
  const views=text('prototypes/dashboard/src/views.js');
  assert.match(views,/liveRuntime \? panel/);
  assert.match(views,/data-live-approvals/);
});

test('Dutch approval metadata preserves the real operation, reason, target and expiry',()=>{
 const now=Date.parse('2026-11-11T10:00:00Z');
 assert.equal(describeApproval({operation:'tienda.deleteOrder',target:'tienda.example',reason:'método DELETE',risk:'critical',reversible:false,expiresAt:'2026-11-11T10:12:00Z'},now,'nl'),'tienda.deleteOrder · bij tienda.example · método DELETE · risico kritiek · onomkeerbaar · verloopt over 12 min');
});
