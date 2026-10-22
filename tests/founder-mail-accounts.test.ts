import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ToolRequest } from '../packages/gateways/src/contracts.js';
import { founderReferenceChronologyRecord, parseFounderReferenceLibrary } from '../packages/core/src/founder-reference-library.js';
import { buildFounderMailAccountRegistry, planMailAccess } from '../packages/core/src/founder-mail-accounts.js';
import { GoogleWorkspaceAdapter } from '../packages/adapters/src/google-workspace-adapter.js';
import { GoogleWorkspaceWriteAdapter } from '../packages/adapters/src/google-workspace-write-adapter.js';

const noop = async () => {};
const rec = (id: string, value: string, tags: string[]) => ({ id, subject: `founder-reference:mail:${id}`, kind: 'reference' as const, classification: 'current' as const, label: id, value, retention: 'preserve' as const, tags });
const library = parseFounderReferenceLibrary({
  schemaVersion: 1, ownerPrincipalId: 'founder', updatedAt: '2026-10-23T00:00:00.000Z',
  records: [
    rec('mail-persona', 'Persona.Ejemplo@gmail.com', ['mail', 'scope:personal']),
    rec('mail-persona-bis', 'persona.ejemplo@gmail.com', ['mail', 'scope:personal']),
    rec('mail-empresa', 'contacto@empresa.example', ['mail', 'scope:business']),
    rec('mail-hijo', 'hijo@gmail.com', ['mail', 'scope:family', 'minor', 'scope-inferred']),
    { id: 'no-mail', subject: 'founder-reference:social:x', kind: 'reference', classification: 'current', label: 'x', value: 'https://example.com', retention: 'preserve', tags: ['social'] },
  ],
});

test('registro de buzones: normaliza, no duplica, deduce proveedor solo para Gmail y respeta ámbito y menor', () => {
  const registry = buildFounderMailAccountRegistry(library);
  assert.deepEqual(registry.accounts.map((a) => a.address), ['persona.ejemplo@gmail.com', 'contacto@empresa.example', 'hijo@gmail.com']);
  const by = Object.fromEntries(registry.accounts.map((a) => [a.accountId, a]));
  assert.equal(by['mail-persona']!.provider, 'google');
  assert.equal(by['mail-empresa']!.provider, 'unknown', 'un dominio propio no se presume Google Workspace');
  assert.equal(by['mail-empresa']!.scope, 'business');
  assert.equal(by['mail-hijo']!.scope, 'family');
  assert.equal(by['mail-hijo']!.minor, true);
  assert.equal(by['mail-hijo']!.scopeInferred, true);
  assert.deepEqual(by['mail-hijo']!.permittedDraftActions, [], 'un menor: sin borradores');
  assert.deepEqual(by['mail-persona']!.permittedDraftActions, ['gmail.draft.create']);
  assert.equal(by['mail-persona']!.credentialService, 'google-workspace:mail-persona');
});

test('política: supervisión del Founder, nada de enviar, borrar, archivar, reenviar ni responder solo', () => {
  const { policy } = buildFounderMailAccountRegistry(library);
  assert.equal(policy.supervision, 'founder');
  assert.equal(policy.readAllowed, true);
  for (const key of ['sendAllowed', 'deleteAllowed', 'archiveOrLabelAllowed', 'forwardAllowed', 'autoReplyAllowed'] as const) assert.equal(policy[key], false, key);
  assert.equal(policy.draftsRequireFounderApproval, true);
  assert.equal(policy.crossScopeSharing, 'founder-only');
});

test('direcciones inválidas o ids no válidos se rechazan', () => {
  const bad = (value: string, id = 'mail-x') => parseFounderReferenceLibrary({ schemaVersion: 1, ownerPrincipalId: 'founder', updatedAt: '2026-10-23T00:00:00.000Z', records: [rec(id, value, ['mail'])] });
  // Primera barrera: el parser de la biblioteca.
  assert.throws(() => buildFounderMailAccountRegistry(bad('no-es-un-correo')), /valid mail address/);
  // Segunda barrera: el registro, aunque se le entregue un documento que no pasó por el parser.
  const unparsed = { schemaVersion: 1 as const, ownerPrincipalId: 'founder', updatedAt: '2026-10-23T00:00:00.000Z', records: [rec('mail-x', 'no-es-un-correo', ['mail'])] };
  assert.throws(() => buildFounderMailAccountRegistry(unparsed), /Invalid mail address/);
  assert.throws(() => buildFounderMailAccountRegistry(bad('a@b.example', 'Mail_X')), /lowercase slug/);
});

test('parser: un buzón etiquetado "mail" es una dirección, el resto de referencias sigue exigiendo HTTPS', () => {
  const doc = (records: unknown[]) => ({ schemaVersion: 1, ownerPrincipalId: 'founder', updatedAt: '2026-10-23T00:00:00.000Z', records });
  // Una dirección sin etiqueta "mail" NO es una URL válida.
  assert.throws(() => parseFounderReferenceLibrary(doc([rec('r1', 'persona@gmail.com', ['social'])])), /valid URL/);
  // Una URL con etiqueta "mail" tampoco es una dirección.
  assert.throws(() => parseFounderReferenceLibrary(doc([rec('r2', 'https://example.com', ['mail'])])), /valid mail address/);
  // HTTP sigue prohibido para el resto.
  assert.throws(() => parseFounderReferenceLibrary(doc([rec('r3', 'http://example.com', ['social'])])), /HTTPS/);
  assert.doesNotThrow(() => parseFounderReferenceLibrary(doc([rec('r4', 'persona@gmail.com', ['mail']), rec('r5', 'https://example.com/a', ['social'])])));
});

test('cronología: el buzón se registra como buzón supervisado, no como "URL de origen"', () => {
  const seed = library.records.find((r) => r.id === 'mail-persona')!;
  const record = founderReferenceChronologyRecord({ seed, ownerPrincipalId: 'founder', at: '2026-10-23T00:00:00.000Z' });
  assert.match(record.content, /Founder mailbox/);
  assert.match(record.content, /bajo supervisión del Founder/);
  assert.doesNotMatch(record.content, /source URL/);
  const social = founderReferenceChronologyRecord({ seed: { ...seed, id: 'soc', subject: 'founder-reference:social:soc', value: 'https://example.com/a', tags: ['social'] }, ownerPrincipalId: 'founder', at: '2026-10-23T00:00:00.000Z' });
  assert.match(social.content, /source URL/);
});

test('plan: dominio propio sin confirmar, sin credencial, y lista', () => {
  const accounts = buildFounderMailAccountRegistry(library).accounts;
  const base = { adapters: new Set(['google-workspace']), hasCredential: (id: string) => id === 'mail-persona' };
  const plan = Object.fromEntries(planMailAccess(accounts, base).map((p) => [p.accountId, p]));
  assert.equal(plan['mail-persona']!.readiness, 'ready');
  assert.equal(plan['mail-empresa']!.readiness, 'needs_provider_confirmation');
  assert.match(plan['mail-empresa']!.nextStep, /IMAP/);
  assert.equal(plan['mail-hijo']!.readiness, 'needs_auth');
  assert.match(plan['mail-hijo']!.nextStep, /supervisión/);

  const confirmed = Object.fromEntries(planMailAccess(accounts, { ...base, confirmedGoogleDomains: new Set(['empresa.example']) }).map((p) => [p.accountId, p]));
  assert.equal(confirmed['mail-empresa']!.readiness, 'needs_auth');
  const sinAdaptador = planMailAccess(accounts, { adapters: new Set(), hasCredential: () => true });
  assert.ok(sinAdaptador.filter((p) => p.readiness !== 'needs_provider_confirmation').every((p) => p.readiness === 'adapter_missing'));
});

test('el repositorio público no contiene ninguna dirección de correo (solo ejemplos)', () => {
  // Guardián genérico: no nombra ninguna dirección real. Cualquier correo en estos archivos es un fallo,
  // salvo dominios de ejemplo reservados.
  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const allowed = /@(?:[A-Za-z0-9-]+\.)*(?:example|invalid|test)(?:\.[A-Za-z]+)?$|@example\.(?:com|org|net)$/i;
  const files = [
    '../config/founder-reference-library.json',
    '../.env.example',
    '../docs/founder-social-source-readiness.md',
    '../docs/integrations.md',
    '../docs/handoffs/2026-10-23-social-accounts-mail-watch.md',
  ];
  for (const file of files) {
    const text = readFileSync(new URL(file, import.meta.url), 'utf8');
    const real = (text.match(email) ?? []).filter((address) => !allowed.test(address));
    assert.equal(real.length, 0, `${file} contiene ${real.length} dirección(es) de correo`);
  }
});

/* ------------------------------ Adaptadores de Google con varias cuentas ------------------------------ */

function fakeFetch() {
  const calls: Array<{ url: string; auth: string | null }> = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), auth: new Headers(init.headers).get('authorization') });
    return new Response(JSON.stringify({ items: [], messages: [], id: 'd1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}
const read = (account?: unknown): ToolRequest => ({ tool: 'google-workspace', action: 'calendar.events.list', input: account === undefined ? {} : { account } });

test('lectura multi-cuenta: cada buzón usa su propio token; cuentas no registradas se rechazan; sin cuenta nada cambia', async () => {
  const { impl, calls } = fakeFetch();
  const adapter = new GoogleWorkspaceAdapter({
    tokenProvider: async () => 'TOKEN-POR-DEFECTO',
    accountTokenProvider: async (id) => (id === 'mail-hijo' ? undefined : `TOKEN-${id}`),
    allowedAccounts: new Set(['mail-persona', 'mail-hijo']),
    fetchImpl: impl,
  });
  const a = await adapter.execute(read('mail-persona'), noop);
  assert.equal(a.ok, true);
  assert.equal(calls.at(-1)!.auth, 'Bearer TOKEN-mail-persona');

  const def = await adapter.execute(read(), noop);
  assert.equal(def.ok, true);
  assert.equal(calls.at(-1)!.auth, 'Bearer TOKEN-POR-DEFECTO');

  const before = calls.length;
  for (const account of ['intruso', '../x', 'MAIL-PERSONA', 42, '']) {
    const res = await adapter.execute(read(account), noop);
    assert.equal(res.ok, false, String(account));
    assert.match(res.error ?? '', /not registered/);
  }
  const sinAutorizar = await adapter.execute(read('mail-hijo'), noop);
  assert.equal(sinAutorizar.ok, false);
  assert.match(sinAutorizar.error ?? '', /not authenticated/);
  assert.equal(calls.length, before, 'ninguna cuenta rechazada llegó a la red');
});

test('escritura multi-cuenta: borradores en el buzón correcto; un menor queda fuera de escritura', async () => {
  const { impl, calls } = fakeFetch();
  const adapter = new GoogleWorkspaceWriteAdapter({
    accountTokenProvider: async (id) => `W-${id}`,
    allowedAccounts: new Set(['mail-persona']), // el menor no está
    fetchImpl: impl,
  });
  const draft = (account: string): ToolRequest => ({ tool: 'google-workspace-write', action: 'gmail.draft.create', input: { account, to: ['a@b.example'], subject: 'Hola', body: 'Texto' } });
  const ok = await adapter.execute(draft('mail-persona'), noop);
  assert.equal(ok.ok, true);
  assert.equal(ok.output!.sent, false);
  assert.equal(calls.at(-1)!.auth, 'Bearer W-mail-persona');

  const before = calls.length;
  const menor = await adapter.execute(draft('mail-hijo'), noop);
  assert.equal(menor.ok, false);
  assert.match(menor.error ?? '', /minors are read-only/);
  assert.equal(calls.length, before);
});
