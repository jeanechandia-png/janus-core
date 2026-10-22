import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ToolRequest } from '../packages/gateways/src/contracts.js';
import { founderReferenceChronologyRecord, parseFounderReferenceLibrary } from '../packages/core/src/founder-reference-library.js';
import { buildFounderMailAccountRegistry, planMailAccess } from '../packages/core/src/founder-mail-accounts.js';
import { GoogleWorkspaceAdapter } from '../packages/adapters/src/google-workspace-adapter.js';
import { GoogleWorkspaceWriteAdapter, draftBodyDigest } from '../packages/adapters/src/google-workspace-write-adapter.js';

const noop = async () => {};
const rec = (id: string, value: string, tags: string[]) => ({ id, subject: `founder-reference:mail:${id}`, kind: 'reference' as const, classification: 'current' as const, label: id, value, retention: 'preserve' as const, tags });
const library = parseFounderReferenceLibrary({
  schemaVersion: 1, ownerPrincipalId: 'founder', updatedAt: '2026-10-23T00:00:00.000Z',
  records: [
    rec('mail-persona', 'Persona.Ejemplo@gmail.com', ['mail', 'scope:personal']),
    rec('mail-persona-bis', 'persona.ejemplo@gmail.com', ['mail', 'scope:personal']),
    rec('mail-empresa', 'contacto@empresa.example', ['mail', 'scope:business']),
    rec('mail-hijo', 'hijo@gmail.com', ['mail', 'scope:family', 'minor', 'scope-inferred']),
    rec('mail-hija', 'hija@gmail.com', ['mail', 'scope:family', 'minor', 'guardian-managed', 'founder-consent:2026-10-23']),
    { id: 'no-mail', subject: 'founder-reference:social:x', kind: 'reference', classification: 'current', label: 'x', value: 'https://example.com', retention: 'preserve', tags: ['social'] },
  ],
});

test('registro de buzones: normaliza, no duplica, deduce proveedor solo para Gmail y respeta ámbito y menor', () => {
  const registry = buildFounderMailAccountRegistry(library);
  assert.deepEqual(registry.accounts.map((a) => a.address), ['persona.ejemplo@gmail.com', 'contacto@empresa.example', 'hijo@gmail.com', 'hija@gmail.com']);
  const by = Object.fromEntries(registry.accounts.map((a) => [a.accountId, a]));
  assert.equal(by['mail-persona']!.provider, 'google');
  assert.equal(by['mail-empresa']!.provider, 'unknown', 'un dominio propio no se presume Google Workspace');
  assert.equal(by['mail-empresa']!.scope, 'business');
  assert.equal(by['mail-hijo']!.scope, 'family');
  assert.equal(by['mail-hijo']!.minor, true);
  assert.equal(by['mail-hijo']!.scopeInferred, true);
  assert.deepEqual(by['mail-hijo']!.permittedWriteActions, [], 'un menor sin la marca guardian-managed: solo lectura');
  assert.equal(by['mail-hijo']!.guardianManaged, false);
  assert.deepEqual(by['mail-hija']!.permittedWriteActions, ['gmail.draft.create', 'gmail.draft.update', 'gmail.draft.send'], 'un menor administrado por el Founder se trata como las demás cuentas');
  assert.equal(by['mail-hija']!.guardianManaged, true);
  assert.equal(by['mail-hija']!.founderConsentAt, '2026-10-23');
  assert.equal(by['mail-persona']!.founderConsentAt, undefined, 'sin etiqueta no se inventa un consentimiento');
  assert.deepEqual(by['mail-persona']!.permittedWriteActions, ['gmail.draft.create', 'gmail.draft.update', 'gmail.draft.send']);
  assert.equal(by['mail-persona']!.credentialService, 'google-workspace:mail-persona');
});

test('política: el Founder da las instrucciones y confirma cada envío; nada se envía, borra, archiva, reenvía ni responde solo', () => {
  const { policy } = buildFounderMailAccountRegistry(library);
  assert.equal(policy.supervision, 'founder');
  assert.equal(policy.readAllowed, true);
  for (const key of ['autonomousSendAllowed', 'deleteAllowed', 'archiveOrLabelAllowed', 'forwardAllowed', 'autoReplyAllowed'] as const) assert.equal(policy[key], false, key);
  assert.equal(policy.composeOnFounderInstruction, true);
  assert.equal(policy.sendRequiresPerMessageApproval, true);
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
  assert.match(plan['mail-hijo']!.nextStep, /guardian-managed/);
  assert.match(plan['mail-hija']!.nextStep, /consentimiento/);

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
    '../docs/handoffs/2026-10-23-vault-oauth-phone-watch.md',
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
  assert.match(menor.error ?? '', /guardian-managed/);
  assert.equal(calls.length, before);
});

/* ------------------------------ Corregir y enviar borradores ------------------------------ */

type Call = { method: string; url: string; body: unknown; auth: string | null };

/** Gmail simulado: sirve un borrador con las cabeceras indicadas y registra cada petición. */
function fakeGmail(options: { headers?: Array<{ name: string; value: string }> | null; readStatus?: number; body?: string | null; multipart?: boolean } = {}) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method, url: String(url), body, auth: new Headers(init.headers).get('authorization') });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
    if (method === 'GET' && /\/drafts\/[^/]+$/.test(String(url))) {
      if (options.readStatus && options.readStatus !== 200) return json({ error: { message: 'not found' } }, options.readStatus);
      const text = options.body === undefined ? 'Texto aprobado' : options.body;
      const encoded = text === null ? undefined : { data: Buffer.from(text, 'utf8').toString('base64url') };
      const payload = options.headers === null
        ? {}
        : options.multipart
          ? { mimeType: 'multipart/alternative', headers: options.headers ?? [], parts: [{ mimeType: 'text/html', body: { data: Buffer.from('<p>otro</p>').toString('base64url') } }, ...(encoded ? [{ mimeType: 'text/plain', body: encoded }] : [])] }
          : { mimeType: 'text/plain', headers: options.headers ?? [], ...(encoded ? { body: encoded } : {}) };
      return json({ id: 'd1', message: { id: 'm1', payload } });
    }
    if (method === 'POST' && String(url).endsWith('/drafts/send')) return json({ id: 'sent-1', threadId: 't1' });
    if (method === 'PUT') return json({ id: 'd1' });
    return json({ id: 'd1' });
  }) as typeof fetch;
  return { impl, calls };
}

const approvedHeaders = [
  { name: 'To', value: 'Ana Pérez <ana@cliente.example>, luis@cliente.example' },
  { name: 'Cc', value: 'jefe@cliente.example' },
  { name: 'Subject', value: 'Propuesta de marketing' },
];
const sendRequest = (extra: Record<string, unknown> = {}): ToolRequest => ({
  tool: 'google-workspace-write',
  action: 'gmail.draft.send',
  input: { account: 'mail-persona', draftId: 'd1', expect: { to: ['ana@cliente.example', 'LUIS@cliente.example'], cc: ['jefe@cliente.example'], subject: 'Propuesta de marketing', bodySha256: draftBodyDigest('Texto aprobado') }, ...extra },
});
const writer = (gmail: ReturnType<typeof fakeGmail>) => new GoogleWorkspaceWriteAdapter({
  accountTokenProvider: async (id) => `W-${id}`,
  allowedAccounts: new Set(['mail-persona']),
  fetchImpl: gmail.impl,
});
const sends = (gmail: ReturnType<typeof fakeGmail>) => gmail.calls.filter((call) => call.method === 'POST' && call.url.endsWith('/drafts/send'));

test('corregir un borrador: PUT sobre el borrador indicado, sin enviar', async () => {
  const gmail = fakeGmail();
  const res = await writer(gmail).execute({ tool: 'google-workspace-write', action: 'gmail.draft.update', input: { account: 'mail-persona', draftId: 'd1', to: ['ana@cliente.example'], subject: 'Hola', body: 'Texto corregido' } }, noop);
  assert.equal(res.ok, true);
  assert.equal(res.output!.sent, false);
  const put = gmail.calls.find((call) => call.method === 'PUT')!;
  assert.match(put.url, /\/users\/me\/drafts\/d1$/);
  assert.equal((put.body as { id: string }).id, 'd1');
  assert.equal(put.auth, 'Bearer W-mail-persona');
  assert.equal(sends(gmail).length, 0);

  const bad = await writer(gmail).execute({ tool: 'google-workspace-write', action: 'gmail.draft.update', input: { account: 'mail-persona', draftId: '../x', to: ['a@b.example'], subject: 'S', body: 'B' } }, noop);
  assert.equal(bad.ok, false);
});

test('enviar: solo si destinatarios y asunto son exactamente los aprobados', async () => {
  const gmail = fakeGmail({ headers: approvedHeaders });
  const res = await writer(gmail).execute(sendRequest(), noop);
  assert.equal(res.ok, true, res.error);
  assert.equal(res.output!.sent, true);
  assert.equal(sends(gmail).length, 1);
  assert.deepEqual(sends(gmail)[0]!.body, { id: 'd1' });
  assert.equal(sends(gmail)[0]!.auth, 'Bearer W-mail-persona');
  // La comprobación ocurre ANTES del envío.
  assert.ok(gmail.calls.findIndex((call) => call.method === 'GET') < gmail.calls.findIndex((call) => call.method === 'POST'));
});

test('enviar: un borrador alterado tras la aprobación NO se envía', async () => {
  const cases: Array<[string, Array<{ name: string; value: string }>]> = [
    ['destinatario añadido', [{ name: 'To', value: 'ana@cliente.example, luis@cliente.example, intruso@otro.example' }, approvedHeaders[1]!, approvedHeaders[2]!]],
    ['destinatario cambiado', [{ name: 'To', value: 'ana@cliente.example, otro@cliente.example' }, approvedHeaders[1]!, approvedHeaders[2]!]],
    ['copia añadida', [approvedHeaders[0]!, { name: 'Cc', value: 'jefe@cliente.example, espia@otro.example' }, approvedHeaders[2]!]],
    ['asunto cambiado', [approvedHeaders[0]!, approvedHeaders[1]!, { name: 'Subject', value: 'Otra cosa' }]],
  ];
  for (const [name, headers] of cases) {
    const gmail = fakeGmail({ headers });
    const res = await writer(gmail).execute(sendRequest(), noop);
    assert.equal(res.ok, false, name);
    assert.match(res.error ?? '', /no longer matches/, name);
    assert.equal(sends(gmail).length, 0, `${name}: no debe haberse enviado nada`);
  }
});

test('enviar: falla cerrado si no hay aprobación explícita, si el borrador no se puede leer o verificar', async () => {
  const noExpect = fakeGmail({ headers: approvedHeaders });
  assert.match((await writer(noExpect).execute(sendRequest({ expect: undefined }), noop)).error ?? '', /expect\.to and expect\.subject/);
  assert.match((await writer(noExpect).execute(sendRequest({ expect: { to: [], subject: 'x' } }), noop)).error ?? '', /expect\.to and expect\.subject/);
  assert.match((await writer(noExpect).execute(sendRequest({ draftId: 'x/../y' }), noop)).error ?? '', /draftId/);
  assert.equal(noExpect.calls.length, 0, 'ni siquiera se consultó Gmail');

  const unreadable = fakeGmail({ readStatus: 404 });
  const a = await writer(unreadable).execute(sendRequest(), noop);
  assert.equal(a.ok, false);
  assert.match(a.error ?? '', /Nothing was sent/);
  assert.equal(sends(unreadable).length, 0);

  const noHeaders = fakeGmail({ headers: null });
  const b = await writer(noHeaders).execute(sendRequest(), noop);
  assert.equal(b.ok, false);
  assert.match(b.error ?? '', /could not be verified/);
  assert.equal(sends(noHeaders).length, 0);

  const wrongAccount = fakeGmail({ headers: approvedHeaders });
  const c = await writer(wrongAccount).execute(sendRequest({ account: 'mail-hijo' }), noop);
  assert.equal(c.ok, false);
  assert.equal(wrongAccount.calls.length, 0);
});

test('enviar: acepta un asunto codificado RFC 2047 (UTF-8/base64) igual al aprobado', async () => {
  const encoded = `=?UTF-8?B?${Buffer.from('Señal de humo', 'utf8').toString('base64')}?=`;
  const gmail = fakeGmail({ headers: [approvedHeaders[0]!, approvedHeaders[1]!, { name: 'Subject', value: encoded }] });
  const res = await writer(gmail).execute(sendRequest({ expect: { to: ['ana@cliente.example', 'luis@cliente.example'], cc: ['jefe@cliente.example'], subject: 'Señal de humo', bodySha256: draftBodyDigest('Texto aprobado') } }), noop);
  assert.equal(res.ok, true, res.error);
  assert.equal(sends(gmail).length, 1);
});

test('enviar: un Cco añadido al borrador NO se envía; uno aprobado explícitamente sí', async () => {
  const withBcc = fakeGmail({ headers: [...approvedHeaders, { name: 'Bcc', value: 'oculto@otro.example' }] });
  const refused = await writer(withBcc).execute(sendRequest(), noop);
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /no longer matches/);
  assert.equal(sends(withBcc).length, 0);

  const approved = fakeGmail({ headers: [...approvedHeaders, { name: 'Bcc', value: 'Archivo <archivo@cliente.example>' }] });
  const request = sendRequest();
  (request.input as { expect: Record<string, unknown> }).expect.bcc = ['archivo@cliente.example'];
  const ok = await writer(approved).execute(request, noop);
  assert.equal(ok.ok, true, ok.error);
  assert.equal(ok.output!.recipients, 4);
  assert.equal(sends(approved).length, 1);
});

test('enviar: el texto debe ser el aprobado (expect.bodySha256 obligatorio; también en multiparte); sin poder verificarlo, no se envía', async () => {
  const expectation = (text: string) => sendRequest({ expect: { to: ['ana@cliente.example', 'luis@cliente.example'], cc: ['jefe@cliente.example'], subject: 'Propuesta de marketing', bodySha256: draftBodyDigest(text) } });

  const same = fakeGmail({ headers: approvedHeaders, body: 'Texto aprobado\r\n' });
  const ok = await writer(same).execute(expectation('Texto aprobado'), noop);
  assert.equal(ok.ok, true, ok.error);
  assert.equal(ok.output!.bodyVerified, true);

  const multipart = fakeGmail({ headers: approvedHeaders, body: 'Texto aprobado', multipart: true });
  assert.equal((await writer(multipart).execute(expectation('Texto aprobado'), noop)).ok, true);

  const edited = fakeGmail({ headers: approvedHeaders, body: 'Texto aprobado. PD: transfiere 5.000 € a esta cuenta.' });
  const refused = await writer(edited).execute(expectation('Texto aprobado'), noop);
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /body no longer matches/);
  assert.equal(sends(edited).length, 0);

  const noBody = fakeGmail({ headers: approvedHeaders, body: null });
  const unverifiable = await writer(noBody).execute(expectation('Texto aprobado'), noop);
  assert.equal(unverifiable.ok, false);
  assert.match(unverifiable.error ?? '', /could not be verified/);
  assert.equal(sends(noBody).length, 0);

  const badHash = fakeGmail({ headers: approvedHeaders });
  const invalid = await writer(badHash).execute(sendRequest({ expect: { to: ['ana@cliente.example'], subject: 'x', bodySha256: 'no-es-un-hash' } }), noop);
  assert.equal(invalid.ok, false);
  assert.match(invalid.error ?? '', /bodySha256/);
  assert.equal(badHash.calls.length, 0, 'ni se consulta Gmail');

  // Sin bodySha256 NO se envía: el texto siempre debe quedar ligado a lo aprobado, y ni se consulta Gmail.
  const unbound = fakeGmail({ headers: approvedHeaders });
  const missing = await writer(unbound).execute(sendRequest({ expect: { to: ['ana@cliente.example', 'luis@cliente.example'], cc: ['jefe@cliente.example'], subject: 'Propuesta de marketing' } }), noop);
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? '', /bodySha256/);
  assert.equal(unbound.calls.length, 0);
});
