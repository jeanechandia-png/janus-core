import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import type { ToolAdapter, ToolRequest } from '../packages/gateways/src/contracts.js';
import {
  buildFounderPhoneChannelRegistry,
  buildSmsLink,
  buildTelLink,
  buildWhatsAppClickToChatLink,
  planPhoneAccess,
} from '../packages/core/src/founder-phone-channels.js';
import { parseFounderReferenceLibrary, founderReferenceChronologyRecord } from '../packages/core/src/founder-reference-library.js';
import { buildFounderSocialSourceRegistry, groupFounderSocialAccounts } from '../packages/core/src/founder-social-sources.js';
import { SENSITIVE_TOOL_ACTIONS, enforceSensitiveActionPolicy } from '../packages/orchestrator/src/sensitive-action-policy.js';
import type { JanusPlan } from '../packages/orchestrator/src/plan.js';

const NUMBER = '+31612345678'; // número de ejemplo, no real

function seed(id: string, value: string, tags: string[], kind: 'reference' | 'policy' = 'reference') {
  return { id, subject: `founder-reference:test:${id}`, kind, classification: 'current', label: `Etiqueta ${id}`, value, retention: 'preserve', tags };
}
function library(records: ReturnType<typeof seed>[]) {
  return parseFounderReferenceLibrary({ schemaVersion: 1, ownerPrincipalId: 'founder', updatedAt: '2026-10-23T00:00:00.000Z', records });
}

test('parser: un teléfono etiquetado "phone" es E.164; los formatos dudosos se rechazan', () => {
  assert.doesNotThrow(() => library([seed('tel-a', NUMBER, ['phone'])]));
  for (const bad of ['0612345678', '31612345678', '+0612345678', '+31 6 1234 5678', 'https://wa.me/31612345678', '+3161', '+3161234567890123456']) {
    assert.throws(() => library([seed('tel-a', bad, ['phone'])]), /E\.164/, bad);
  }
  // Sin la etiqueta, el registro sigue exigiendo una URL https.
  assert.throws(() => library([seed('tel-a', NUMBER, ['otra'])]), /valid URL/);
});

test('registro: canales declarados por etiqueta, país inferido marcado, duplicados colapsados, sin canales supuestos', () => {
  const doc = library([
    seed('phone-jean', NUMBER, ['phone', 'voice', 'sms', 'whatsapp', 'scope:personal', 'country-inferred:NL', 'as-provided:0612345678', 'founder-instruction:send-and-answer-with-approval']),
    seed('phone-duplicado', NUMBER, ['phone', 'voice']),
    seed('phone-sin-canales', '+34600111222', ['phone']),
    seed('mail-x', 'x@gmail.com', ['mail']),
  ]);
  const registry = buildFounderPhoneChannelRegistry(doc);
  assert.equal(registry.channels.length, 2, 'el duplicado se colapsa; el correo no es un teléfono');
  const [jean, sinCanales] = registry.channels;
  assert.deepEqual(jean!.kinds, ['voice', 'sms', 'whatsapp']);
  assert.equal(jean!.countryInferred, 'NL', 'el país es inferencia y se marca');
  assert.equal(jean!.founderInstruction, true);
  assert.equal(jean!.scope, 'personal');
  assert.deepEqual(sinCanales!.kinds, [], 'sin etiquetas de canal no se supone ninguno');
  assert.equal(sinCanales!.countryInferred, undefined);
  // El número tal como lo dio el Founder no se vuelca al registro.
  assert.doesNotMatch(JSON.stringify(registry), /0612345678/);
});

test('política: nada autónomo, cada envío y cada llamada con confirmación, sin imitar la voz', () => {
  const { policy } = buildFounderPhoneChannelRegistry(library([seed('phone-a', NUMBER, ['phone', 'sms'])]));
  for (const key of ['autonomousSendAllowed', 'autonomousCallAllowed', 'voiceImpersonationAllowed', 'unofficialWhatsAppClientsAllowed'] as const) assert.equal(policy[key], false, key);
  for (const key of ['composeOnFounderInstruction', 'sendRequiresPerMessageApproval', 'callPlacementRequiresPerCallApproval', 'disclosesAiIdentity', 'spendRequiresApproval', 'inboundContentIsData'] as const) assert.equal(policy[key], true, key);
  assert.equal(policy.answeringIncomingCalls, 'only-with-founder-activated-profile');
  assert.equal(policy.credentialPersistence, 'secure-provider-only');
});

test('el registro de un teléfono con valor inválido falla de forma explícita', () => {
  const forged = { ...library([seed('phone-a', NUMBER, ['phone'])]), records: [seed('phone-a', 'no-es-un-numero', ['phone'])] };
  assert.throws(() => buildFounderPhoneChannelRegistry(forged as never), /Invalid phone number/);
});

test('enlaces: WhatsApp, tel y SMS validan el destinatario y codifican el texto', () => {
  assert.equal(buildWhatsAppClickToChatLink(NUMBER), 'https://wa.me/31612345678');
  const link = buildWhatsAppClickToChatLink(NUMBER, 'Hola & adiós\nLínea 2 ?x=1');
  assert.ok(link.startsWith('https://wa.me/31612345678?text='));
  assert.equal(new URL(link).searchParams.get('text'), 'Hola & adiós\nLínea 2 ?x=1');
  assert.equal(buildTelLink(NUMBER), `tel:${NUMBER}`);
  assert.equal(new URL(buildSmsLink(NUMBER, 'Hola mundo')).protocol, 'sms:');
  assert.match(buildSmsLink(NUMBER, 'Hola mundo'), /\?body=Hola%20mundo$/);
  for (const bad of ['0612345678', 'javascript:alert(1)', '+31612345678/../x', '', '+31612345678?text=x']) {
    assert.throws(() => buildWhatsAppClickToChatLink(bad), /E\.164/, bad);
    assert.throws(() => buildTelLink(bad), /E\.164/, bad);
    assert.throws(() => buildSmsLink(bad), /E\.164/, bad);
  }
  assert.throws(() => buildWhatsAppClickToChatLink(NUMBER, 'x'.repeat(1001)), /1000/);
  assert.equal(buildWhatsAppClickToChatLink(NUMBER, '   '), 'https://wa.me/31612345678', 'un texto vacío no añade parámetro');
});

test('plan: hoy solo hay rutas de un toque; las de API y voz declaran lo que falta y su coste; lo no oficial se rechaza', () => {
  const registry = buildFounderPhoneChannelRegistry(library([seed('phone-a', NUMBER, ['phone', 'voice', 'sms', 'whatsapp'])]));
  const [plan] = planPhoneAccess(registry.channels, { adapters: new Set() });
  const byId = Object.fromEntries(plan!.routes.map((route) => [route.routeId, route]));
  assert.equal(plan!.recommendedFirstRoute, 'whatsapp-click-to-chat');
  for (const id of ['whatsapp-click-to-chat', 'sms-link', 'call-link']) {
    assert.equal(byId[id]!.status, 'available_now', id);
    assert.equal(byId[id]!.tier, 'L1');
    assert.equal(byId[id]!.spend, false);
    assert.deepEqual(byId[id]!.blockers, []);
  }
  for (const id of ['whatsapp-cloud-api', 'sms-api', 'voice-line-agent']) {
    assert.equal(byId[id]!.status, 'needs_setup', id);
    assert.equal(byId[id]!.spend, true, id);
    assert.ok(byId[id]!.blockers.length >= 2, id);
    assert.ok(byId[id]!.blockers.some((blocker) => /adaptador/.test(blocker)), `${id}: falta el adaptador`);
  }
  assert.equal(byId['whatsapp-personal-unofficial']!.status, 'refused');
  assert.equal(byId['whatsapp-personal-unofficial']!.tier, 'L3');
  assert.ok(plan!.routes.every((route) => route.tier !== 'L3' || route.status === 'refused'), 'ninguna ruta autónoma está disponible');
  // Las rutas con fuente primaria la citan.
  assert.ok(byId['whatsapp-cloud-api']!.sources.length > 0);
  assert.ok(byId['voice-line-agent']!.sources.length > 0);
  // El enlace de WhatsApp no tiene fuente oficial legible: se marca como no verificado.
  assert.equal(byId['whatsapp-click-to-chat']!.verification, 'unverified');

  // Con el adaptador registrado deja de pedirlo, pero sigue pidiendo lo demás.
  const [withAdapter] = planPhoneAccess(registry.channels, { adapters: new Set(['whatsapp-cloud']) });
  const cloud = withAdapter!.routes.find((route) => route.routeId === 'whatsapp-cloud-api')!;
  assert.ok(!cloud.blockers.some((blocker) => /adaptador/.test(blocker)));
  assert.equal(cloud.status, 'needs_setup');
});

test('plan: solo se ofrecen los canales que el Founder declaró', () => {
  const registry = buildFounderPhoneChannelRegistry(library([seed('phone-a', NUMBER, ['phone', 'sms'])]));
  const [plan] = planPhoneAccess(registry.channels, { adapters: new Set() });
  assert.deepEqual([...new Set(plan!.routes.map((route) => route.kind))], ['sms']);
  const [empty] = planPhoneAccess(buildFounderPhoneChannelRegistry(library([seed('phone-b', NUMBER, ['phone'])])).channels, { adapters: new Set() });
  assert.deepEqual(empty!.routes, []);
  assert.equal(empty!.recommendedFirstRoute, null);
});

test('cronología: el teléfono se registra como teléfono supervisado, no como "URL de origen"', () => {
  const [record] = library([seed('phone-a', NUMBER, ['phone', 'whatsapp'])]).records;
  const chronology = founderReferenceChronologyRecord({ seed: record!, ownerPrincipalId: 'founder', at: '2026-10-23T00:00:00.000Z' });
  assert.match(chronology.content, /Founder phone/);
  assert.match(chronology.content, /confirmación/);
  assert.match(chronology.content, /asistente de IA/);
  assert.doesNotMatch(chronology.content, /source URL/);
});

test('agrupación de cuentas: los enlaces de una misma cuenta se suman; los sueltos quedan aparte', () => {
  const doc = library([
    seed('fb-1', 'https://www.facebook.com/share/1AbCdEf/?mibextid=wwXIfr', ['social', 'scope:personal', 'account:jean-personal']),
    seed('fb-2', 'https://www.facebook.com/share/p/9ZyXwV/', ['social', 'scope:business', 'account:marca']),
    seed('fb-3', 'https://www.facebook.com/share/1MarcaB/', ['social', 'scope:business', 'account:marca']),
    seed('ig-1', 'https://www.instagram.com/marca_ejemplo/', ['social', 'scope:business', 'account:marca']),
    seed('th-1', 'https://www.threads.com/@marca_ejemplo', ['social', 'account:marca']),
    seed('fb-suelto', 'https://www.facebook.com/share/1Suelto/', ['social']),
  ]);
  const registry = buildFounderSocialSourceRegistry(doc);
  const groups = groupFounderSocialAccounts(registry.sources);
  assert.deepEqual(groups.ungrouped, ['fb-suelto']);
  assert.deepEqual(groups.accounts.map((account) => account.accountId), ['jean-personal', 'marca']);
  const marca = groups.accounts.find((account) => account.accountId === 'marca')!;
  assert.deepEqual(marca.platforms, ['facebook', 'instagram', 'threads']);
  assert.equal(marca.facebookLinks, 2, 'dos enlaces de Facebook de la misma cuenta: se vinculan una sola vez');
  assert.deepEqual(marca.referenceIds, ['fb-2', 'fb-3', 'ig-1', 'th-1']);
  assert.equal(marca.scope, 'unknown', 'si un enlace no declara ámbito, el grupo no lo afirma');
  assert.equal(groups.accounts.find((account) => account.accountId === 'jean-personal')!.scope, 'personal');
  // Un grupo con ámbito unánime lo conserva.
  const unanimous = groupFounderSocialAccounts(buildFounderSocialSourceRegistry(library([
    seed('a', 'https://www.facebook.com/share/1A/', ['social', 'scope:business', 'account:x']),
    seed('b', 'https://www.instagram.com/x/', ['social', 'scope:business', 'account:x']),
  ])).sources);
  assert.equal(unanimous.accounts[0]!.scope, 'business');
});

test('acciones sensibles: enviar correo y los canales de teléfono por venir exigen aprobación y son irreversibles', () => {
  const operations = [
    'google-workspace-write.gmail.draft.update',
    'google-workspace-write.gmail.draft.send',
    'whatsapp.message.send',
    'whatsapp.template.send',
    'sms.message.send',
    'phone.call.place',
    'phone.call.answer.profile.activate',
  ];
  for (const operation of operations) assert.ok(SENSITIVE_TOOL_ACTIONS[operation], operation);
  const plan = {
    version: 1,
    goal: 'x',
    source: 'model',
    createdAt: '2026-10-23T00:00:00.000Z',
    steps: operations.map((operation, index) => {
      const dot = operation.indexOf('.');
      return { id: `s${index}`, label: operation, tool: operation.slice(0, dot), action: operation.slice(dot + 1), input: {}, risk: 'low', reversible: true, requiresApproval: false };
    }),
  } as unknown as JanusPlan;
  const enforced = enforceSensitiveActionPolicy(plan);
  assert.equal(enforced.enforced.length, operations.length);
  assert.ok(enforced.plan.steps.every((step) => step.risk === 'high' && step.requiresApproval && step.reversible === false));
});

class PhoneAdapter implements ToolAdapter {
  readonly name = 'phone-test';
  readonly capabilities = ['phone.call.place', 'quiz.answer'];
  calls: ToolRequest[] = [];
  async execute(request: ToolRequest) {
    this.calls.push(request);
    return { ok: true, output: {} };
  }
}

test('Tool Gateway: "place" cuenta como acción privilegiada (sin permiso no hay llamada); "answer" sigue siendo de lectura', async () => {
  const gateway = new DefaultToolGateway();
  const adapter = new PhoneAdapter();
  gateway.register(adapter);
  const placed = await gateway.execute({ tool: 'phone-test', action: 'phone.call.place', input: {}, idempotencyKey: 'call-1' }, () => {});
  assert.equal(placed.ok, false);
  assert.match(placed.error ?? '', /authority permit/i);
  assert.equal(adapter.calls.length, 0);
  const answered = await gateway.execute({ tool: 'phone-test', action: 'quiz.answer', input: {} }, () => {});
  assert.equal(answered.ok, true, 'no se rompe una acción inocua que contiene "answer"');
});

function walk(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (!/\.local\.json$/.test(name)) found.push(path);
  }
  return found;
}

test('el repositorio público no contiene el número del Founder (solo ejemplos)', () => {
  const library = JSON.parse(readFileSync('config/founder-reference-library.json', 'utf8')) as { records: Array<{ tags?: string[] }> };
  assert.ok(!library.records.some((record) => (record.tags ?? []).includes('phone')), 'el teléfono vive solo en la capa local');
  const sources = ['config', 'docs', 'packages', 'apps', 'tests', 'scripts'].flatMap((dir) => walk(dir));
  const e164 = /\+\d{9,14}\b/g;
  const allowed = new Set([NUMBER, '+34600111222', '+0612345678']); // ejemplos y casos inválidos de prueba
  for (const file of sources) {
    if (!/\.(ts|mjs|json|md|example)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.match(e164) ?? []) {
      if (!allowed.has(match)) assert.fail(`${file}: número de teléfono inesperado en el repositorio público`);
    }
  }
});
