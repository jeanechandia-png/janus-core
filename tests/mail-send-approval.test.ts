import test from 'node:test';
import assert from 'node:assert/strict';
import type { ToolGateway, ToolProgress, ToolRequest, ToolResult } from '../packages/gateways/src/contracts.js';
import { GoogleWorkspaceWriteAdapter, draftBodyDigest } from '../packages/adapters/src/google-workspace-write-adapter.js';
import { FLOW_TEMPLATES, getFlowTemplate, templateReadiness } from '../packages/automation/src/flow-templates.js';
import { runWorkflow } from '../packages/automation/src/flow-runner.js';
import { validateAutomationWorkflow } from '../packages/automation/src/workflow.js';
import { buildMailSendApprovalCard, parseMailDraftPreview } from '../packages/orchestrator/src/mail-send-approval.js';

const noop = (_: ToolProgress) => undefined;

interface Draft { to: string; cc?: string; bcc?: string; subject: string; text: string; html?: boolean }
interface Call { method: string; url: string }

/** Gmail de mentira con borrador MUTABLE (para simular ediciones después de la vista previa). */
function gmail(initial: Draft) {
  const state: { draft: Draft; calls: Call[] } = { draft: { ...initial }, calls: [] };
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    state.calls.push({ method, url: String(url) });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
    if (method === 'GET' && /\/drafts\/[^/]+$/.test(String(url))) {
      const d = state.draft;
      const headers = [
        ...(d.to ? [{ name: 'To', value: d.to }] : []),
        ...(d.cc ? [{ name: 'Cc', value: d.cc }] : []),
        ...(d.bcc ? [{ name: 'Bcc', value: d.bcc }] : []),
        { name: 'Subject', value: d.subject },
      ];
      const payload = d.html
        ? { mimeType: 'text/html', headers, body: { data: Buffer.from('<p>solo html</p>').toString('base64url') } }
        : { mimeType: 'text/plain', headers, body: { data: Buffer.from(d.text, 'utf8').toString('base64url') } };
      return json({ id: 'd1', message: { id: 'm1', payload } });
    }
    if (method === 'POST' && String(url).endsWith('/drafts/send')) return json({ id: 'sent-1', threadId: 't1' });
    return json({}, 404);
  }) as typeof fetch;
  const sends = () => state.calls.filter((c) => c.method === 'POST' && c.url.endsWith('/drafts/send'));
  const writes = () => state.calls.filter((c) => c.method !== 'GET');
  return { state, impl, sends, writes };
}

const adapterFor = (g: ReturnType<typeof gmail>) => new GoogleWorkspaceWriteAdapter({ accountTokenProvider: async (id) => `W-${id}`, allowedAccounts: new Set(['mail-persona']), fetchImpl: g.impl });
const preview = (g: ReturnType<typeof gmail>, input: Record<string, unknown> = {}) =>
  adapterFor(g).execute({ tool: 'google-workspace-write', action: 'gmail.draft.preview', input: { account: 'mail-persona', draftId: 'd1', ...input } }, noop);

const BASE: Draft = { to: 'Ana Pérez <ANA@cliente.example>, luis@cliente.example', cc: 'jefe@cliente.example', subject: 'Propuesta de marketing', text: 'Hola Ana,\r\nAdjunto la propuesta.\r\n\r\nUn saludo.\r\n' };

// ---------------- Vista previa (solo lectura) ----------------

test('vista previa: destinatarios normalizados y ordenados, texto normalizado, huella = la que exige el envío; no escribe nada', async () => {
  const g = gmail(BASE);
  const res = await preview(g);
  assert.equal(res.ok, true, res.error);
  const out = res.output as Record<string, unknown>;
  assert.deepEqual(out.to, ['ana@cliente.example', 'luis@cliente.example']);
  assert.deepEqual(out.cc, ['jefe@cliente.example']);
  assert.deepEqual(out.bcc, []);
  assert.equal(out.subject, 'Propuesta de marketing');
  assert.equal(out.text, 'Hola Ana,\nAdjunto la propuesta.\n\nUn saludo.', 'saltos CRLF → LF y recorte final');
  assert.equal(out.bodySha256, draftBodyDigest(BASE.text), 'misma función y misma normalización que el envío');
  assert.equal(out.sent, false);
  assert.equal(g.writes().length, 0, 'ni un solo PUT/POST/DELETE');
  assert.ok(g.state.calls.every((c) => c.method === 'GET'));
});

test('vista previa: asunto codificado (RFC 2047) llega decodificado; la copia oculta se muestra', async () => {
  const g = gmail({ ...BASE, subject: `=?UTF-8?B?${Buffer.from('Señal de humo ✔').toString('base64')}?=`, bcc: 'oculto@otro.example' });
  const out = (await preview(g)).output as Record<string, unknown>;
  assert.equal(out.subject, 'Señal de humo ✔');
  assert.deepEqual(out.bcc, ['oculto@otro.example']);
});

test('vista previa: un texto largo se recorta SOLO para mostrar; la huella es del texto completo', async () => {
  const long = 'x'.repeat(30_000);
  const g = gmail({ ...BASE, text: long });
  const out = (await preview(g)).output as { text: string; textTruncated: boolean; bodySha256: string };
  assert.equal(out.text.length, 20_000);
  assert.equal(out.textTruncated, true);
  assert.equal(out.bodySha256, draftBodyDigest(long));
});

test('vista previa: falla cerrado ante lo que no se puede verificar', async () => {
  assert.equal((await preview(gmail({ ...BASE, html: true }))).ok, false, 'solo HTML → no hay texto plano que aprobar');
  assert.equal((await preview(gmail({ ...BASE, to: '' }))).ok, false, 'sin destinatario');
  assert.equal((await preview(gmail({ ...BASE, subject: '' }))).ok, false, 'sin asunto');
  assert.equal((await preview(gmail(BASE), { draftId: '../x' })).ok, false, 'id de borrador malo');
  assert.equal((await preview(gmail(BASE), { account: 'otra-cuenta' })).ok, false, 'cuenta no registrada para escribir');
  const missing = await adapterFor(gmail(BASE)).execute({ tool: 'google-workspace-write', action: 'gmail.draft.preview', input: { draftId: 'd1' } }, noop);
  assert.equal(missing.ok, false, 'sin token');
});

// ---------------- Plantilla ----------------

test('plantilla: existe, valida, es de inicio MANUAL y el envío es de riesgo alto, irreversible y con aprobación', () => {
  const template = getFlowTemplate('correo-enviar-aprobado')!;
  assert.ok(template && FLOW_TEMPLATES.includes(template));
  const wf = template.build();
  assert.equal(validateAutomationWorkflow(wf).ok, true);
  assert.equal(wf.status, 'draft', 'las plantillas nacen como borrador');
  const triggers = wf.nodes.filter((n) => n.kind === 'trigger');
  assert.deepEqual(triggers.map((t) => t.type), ['trigger.manual'], 'ningún cron/webhook/evento puede enviar correo por sí solo');
  const enviar = wf.nodes.find((n) => n.id === 'enviar')!;
  assert.equal(enviar.risk, 'high');
  assert.equal(enviar.reversible, false);
  assert.equal(enviar.requiresApproval, true);
  assert.equal(wf.nodes.find((n) => n.id === 'ver')!.requiresApproval, false, 'leer el borrador no necesita aprobación');
  assert.deepEqual(wf.connections.map((c) => `${c.from}>${c.to}`), ['inicio>ver', 'ver>enviar']);
  // El destinatario/asunto/huella salen SIEMPRE de la vista previa, nunca escritos a mano en la plantilla.
  const expect = (enviar.parameters.expect as Record<string, string>);
  assert.ok(Object.values(expect).every((v) => v.startsWith('{{ $nodes.ver.output.')));
  assert.ok(!JSON.stringify(wf).includes('@'), 'la plantilla no contiene direcciones de correo');
});

test('plantilla: dice la verdad sobre lo que falta (sin conector, en reposo; con conector, lista)', async () => {
  const template = getFlowTemplate('correo-enviar-aprobado')!;
  const { AutomationNodeRegistry } = await import('../packages/automation/src/node-registry.js');
  const { builtinNodeManifests } = await import('../packages/automation/src/node-catalog.js');
  const registry = new AutomationNodeRegistry();
  for (const m of builtinNodeManifests({ tools: true })) registry.register(m);
  const without = templateReadiness(template, { registry, connectors: [] });
  assert.equal(without.ready, false);
  assert.ok(without.missing.some((m) => /google-workspace-write/.test(m)));
  const withIt = templateReadiness(template, { registry, connectors: [{ name: 'google-workspace-write', capabilities: ['gmail.draft.preview', 'gmail.draft.send'] }] });
  assert.equal(withIt.ready, true, withIt.missing.join('; '));
});

// ---------------- Ida y vuelta por el motor ----------------

function gatewayFor(adapter: GoogleWorkspaceWriteAdapter): ToolGateway {
  return { register: () => undefined, execute: async (req: ToolRequest, p: (x: ToolProgress) => void): Promise<ToolResult> => adapter.execute(req, p) } as unknown as ToolGateway;
}
const input = { account: 'mail-persona', draftId: 'd1' };

test('de punta a punta: vista previa → pausa pidiendo aprobación (no envía) → aprobar → envía una vez', async () => {
  const g = gmail(BASE);
  const wf = getFlowTemplate('correo-enviar-aprobado')!.build();
  const tools = gatewayFor(adapterFor(g));
  const first = await runWorkflow(wf, { trigger: { payload: input } }, { tools });
  assert.equal(first.status, 'paused');
  assert.deepEqual(first.pendingApprovals.map((a) => ({ id: a.nodeId, risk: a.risk, reversible: a.reversible })), [{ id: 'enviar', risk: 'high', reversible: false }]);
  assert.equal(g.sends().length, 0, 'sin aprobación no se envía nada');

  // Lo que la persona ve sale de la salida de «ver»; la tarjeta es fiel a ello.
  const shown = parseMailDraftPreview(first.outputs.ver);
  assert.ok(shown, 'la vista previa tiene la forma esperada');
  const card = buildMailSendApprovalCard(shown!);
  assert.deepEqual(card.recipients.to, ['ana@cliente.example', 'luis@cliente.example']);
  assert.equal(card.body, 'Hola Ana,\nAdjunto la propuesta.\n\nUn saludo.');
  assert.equal(shown!.bodySha256, draftBodyDigest(BASE.text));

  const done = await runWorkflow(wf, { resume: { snapshot: first.snapshot, approvals: { enviar: 'approved' } } }, { tools });
  assert.equal(done.status, 'completed', done.error);
  assert.equal(g.sends().length, 1);
  assert.equal((done.outputs.enviar as { sent: boolean; bodyVerified: boolean }).sent, true);
  assert.equal((done.outputs.enviar as { bodyVerified: boolean }).bodyVerified, true);
});

test('rechazar la aprobación: el flujo falla y NO se envía', async () => {
  const g = gmail(BASE);
  const wf = getFlowTemplate('correo-enviar-aprobado')!.build();
  const tools = gatewayFor(adapterFor(g));
  const first = await runWorkflow(wf, { trigger: { payload: input } }, { tools });
  const res = await runWorkflow(wf, { resume: { snapshot: first.snapshot, approvals: { enviar: 'rejected' } } }, { tools });
  assert.equal(res.status, 'failed');
  assert.match(res.error!, /rechazada/i);
  assert.equal(g.sends().length, 0);
});

test('si el borrador cambia DESPUÉS de la vista previa, el envío se rechaza (texto, copia oculta, destinatario o asunto)', async () => {
  const edits: Array<[string, (d: Draft) => Draft, RegExp]> = [
    ['texto', (d) => ({ ...d, text: d.text + '\nP.D. 5.000 € a esta cuenta.' }), /body no longer matches/],
    ['copia oculta añadida', (d) => ({ ...d, bcc: 'espia@otro.example' }), /no longer matches the recipients/],
    ['destinatario cambiado', (d) => ({ ...d, to: 'otra@cliente.example' }), /no longer matches the recipients/],
    ['asunto', (d) => ({ ...d, subject: 'Otro asunto' }), /no longer matches the recipients/],
  ];
  for (const [name, edit, why] of edits) {
    const g = gmail(BASE);
    const wf = getFlowTemplate('correo-enviar-aprobado')!.build();
    const tools = gatewayFor(adapterFor(g));
    const first = await runWorkflow(wf, { trigger: { payload: input } }, { tools });
    assert.equal(first.status, 'paused', name);
    g.state.draft = edit(g.state.draft); // alguien edita el borrador mientras la persona decide
    const res = await runWorkflow(wf, { resume: { snapshot: first.snapshot, approvals: { enviar: 'approved' } } }, { tools });
    assert.equal(res.status, 'failed', name);
    assert.match(res.error!, why, name);
    assert.equal(g.sends().length, 0, `${name}: no se envió`);
  }
});

test('el emisor no puede inventar la aprobación: sin huella el envío no se hace, aunque la persona apruebe', async () => {
  const g = gmail(BASE);
  const wf = getFlowTemplate('correo-enviar-aprobado')!.build();
  // Un flujo manipulado que «olvida» la huella:
  const tampered = { ...wf, nodes: wf.nodes.map((n) => (n.id === 'enviar' ? { ...n, parameters: { ...n.parameters, expect: { to: '{{ $nodes.ver.output.to }}', subject: '{{ $nodes.ver.output.subject }}' } } } : n)) };
  const tools = gatewayFor(adapterFor(g));
  const first = await runWorkflow(tampered, { trigger: { payload: input } }, { tools });
  const res = await runWorkflow(tampered, { resume: { snapshot: first.snapshot, approvals: { enviar: 'approved' } } }, { tools });
  assert.equal(res.status, 'failed');
  assert.match(res.error!, /bodySha256/);
  assert.equal(g.sends().length, 0);
});

// ---------------- Tarjeta ----------------

const P = { draftId: 'd1', to: ['a@x.example'], cc: [], bcc: [], subject: 'Hola', text: 'Texto', textTruncated: false, bodySha256: 'a'.repeat(64) };

test('tarjeta: titular, huella corta y pie; sin avisos en un correo normal', () => {
  const card = buildMailSendApprovalCard(P);
  assert.equal(card.headline, 'Enviar «Hola» a 1 destinatario');
  assert.equal(card.digestShort, 'aaaaaaaaaaaa');
  assert.deepEqual(card.warnings, []);
  assert.match(card.footer, /irreversible/);
});

test('tarjeta: avisa de copia oculta, muchos destinatarios, texto recortado, texto vacío y direcciones repetidas', () => {
  const bcc = buildMailSendApprovalCard({ ...P, bcc: ['oculto@x.example'] });
  assert.match(bcc.warnings[0]!, /copia oculta \(Cco\): oculto@x\.example/);
  const many = buildMailSendApprovalCard({ ...P, to: Array.from({ length: 11 }, (_, i) => `u${i}@x.example`) });
  assert.match(many.warnings.join(' '), /11 destinatarios/);
  const cut = buildMailSendApprovalCard({ ...P, textTruncated: true });
  assert.match(cut.warnings.join(' '), /recortado.*COMPLETO/);
  assert.match(buildMailSendApprovalCard({ ...P, text: '  ' }).warnings.join(' '), /vacío/);
  assert.match(buildMailSendApprovalCard({ ...P, cc: ['a@x.example'] }).warnings.join(' '), /más de un campo/);
});

test('parseMailDraftPreview: solo acepta la forma exacta (huella de 64 hex, listas de texto, al menos un Para)', () => {
  assert.ok(parseMailDraftPreview(P));
  for (const bad of [null, 'x', {}, { ...P, bodySha256: 'zz' }, { ...P, bodySha256: 'abcd' }, { ...P, bodySha256: 'a'.repeat(63) }, { ...P, bodySha256: 'a'.repeat(65) }, { ...P, bodySha256: 'A'.repeat(64) }, { ...P, to: [] }, { ...P, to: [1] }, { ...P, cc: 'a@x' }, { ...P, textTruncated: 'no' }, { ...P, subject: 1 }, { ...P, draftId: undefined }]) {
    assert.equal(parseMailDraftPreview(bad), null, JSON.stringify(bad)?.slice(0, 60));
  }
});
