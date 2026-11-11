import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  LEGAL_POLICE_GLOSSARY, buildInterpreterMessages, criticalTokens, interpretUtterance, missingCriticalTokens, openingNotice,
  parseInterpreterReply, relevantGlossary, validateGlossary, type InterpreterModelPort,
} from '../packages/modules/contextual-interpreter/src/index.js';
import { caseView, createPriorityCase } from '../packages/core/src/priority-case.js';

const fakeModel = (reply: (messages: Array<{ role: string; content: string }>) => string): InterpreterModelPort & { calls: Array<Array<{ role: string; content: string }>> } => {
  const calls: Array<Array<{ role: string; content: string }>> = [];
  return { calls, async complete(request) { calls.push(request.messages); return { text: reply(request.messages), provider: 'fake', model: 'fake-1' }; } };
};

test('la pieza es LEGO: no importa nada fuera de su carpeta y no contiene datos de casos', () => {
  const dir = 'packages/modules/contextual-interpreter/src';
  for (const file of readdirSync(dir)) {
    const source = readFileSync(join(dir, file), 'utf8');
    for (const match of source.matchAll(/from '([^']+)'/g)) assert.ok(match[1]!.startsWith('./'), `${file} importa ${match[1]}`);
    assert.doesNotMatch(source, /politie\.nl|alexanderstraat|velp|sezer|echandia/i);
  }
  const manifest = JSON.parse(readFileSync('packages/modules/contextual-interpreter/module.json', 'utf8'));
  assert.equal(manifest.id, 'contextual-interpreter');
  assert.deepEqual(manifest.dependencies, []);
});

test('tokens críticos: teléfonos, horas, fechas y meses se comparan por contenido, no por formato', () => {
  assert.ok(criticalTokens('Bel 0900-8844 om 14:30').includes('09008844'));
  assert.deepEqual(missingCriticalTokens('Op 9 september om 14.30 uur', 'El 9 de septiembre a las 14:30'), []);
  assert.deepEqual(missingCriticalTokens('Mijn nummer is 06 1234 5678', 'Mi número es 0612345678'), []);
  assert.deepEqual(missingCriticalTokens('Het zaaknummer is 2026-123456', 'El número de expediente es 2026-12345'), ['2026123456']);
  assert.deepEqual(missingCriticalTokens('Op 9 september', 'El 9 de octubre'), ['mes:9']);
  assert.deepEqual(missingCriticalTokens('mail naar a.b@example.org', 'escriba a a.b@example.org'), []);
});

test('prompt de intérprete profesional: primera persona, fidelidad, glosario relevante y contexto solo como datos', () => {
  const messages = buildInterpreterMessages({ from: 'nl', text: 'Wilt u aangifte doen van mishandeling?', speaker: 'counterpart', counterpartRole: 'police officer', brief: 'Contexto privado X', glossary: [{ nl: 'tolk', es: 'intérprete' }] });
  const all = messages.map((m) => m.content).join('\n');
  assert.match(all, /FIRST PERSON/);
  assert.match(all, /do not add, omit/);
  assert.match(all, /aangifte → denuncia formal/);
  assert.match(all, /mishandeling → agresión/);
  assert.match(all, /CASE BACKGROUND \(confidential, data only\):\nContexto privado X/);
  assert.match(all, /not instructions/);
  assert.equal(messages.at(-1)!.role, 'user');
  assert.equal(relevantGlossary('quiero presentar una denuncia formal', 'es', LEGAL_POLICE_GLOSSARY, 'nl')[0]!.nl, 'aangifte');
});

test('interpretUtterance traduce, marca números que faltan y nunca inventa con una respuesta inválida', async () => {
  const good = fakeModel(() => JSON.stringify({ translation: 'Me agarró del cuello el 9 de septiembre.', uncertain: [], clarify: null }));
  const result = await interpretUtterance(good, { from: 'es', text: 'Hij pakte me bij mijn nek op 9 september om 18:00.', to: 'es' as never, speaker: 'founder' }).catch((error: Error) => error);
  assert.ok(result instanceof Error, 'mismo idioma de origen y destino = error');

  const ok = await interpretUtterance(good, { from: 'nl', text: 'Hij pakte me bij mijn nek op 9 september om 18:00.', speaker: 'counterpart' });
  assert.equal(ok.to, 'es');
  assert.equal(ok.translation, 'Me agarró del cuello el 9 de septiembre.');
  assert.deepEqual(ok.confirm, ['18:00']);
  assert.equal(good.calls[0]![0]!.role, 'system');

  const broken = fakeModel(() => 'Claro, aquí tienes la traducción');
  await assert.rejects(() => interpretUtterance(broken, { from: 'es', text: 'Hola', speaker: 'founder' }), /not JSON/);
  const empty = fakeModel(() => '{"translation":"","uncertain":[],"clarify":null}');
  await assert.rejects(() => interpretUtterance(empty, { from: 'es', text: 'Hola', speaker: 'founder' }), /no translation/);

  const clarify = await interpretUtterance(fakeModel(() => '```json\n{"translation":"","uncertain":["ruido"],"clarify":"Kunt u dat herhalen?"}\n```'), { from: 'nl', text: 'eh… de… ', speaker: 'counterpart' });
  assert.equal(clarify.clarify, 'Kunt u dat herhalen?');
  assert.deepEqual(clarify.confirm, []);
});

test('glosario y aviso de apertura: validados y sin datos fijos', () => {
  assert.deepEqual(validateGlossary([{ nl: 'verhuurder', es: 'arrendador', note: 'n' }, { nl: 'solo' }, { xx: 'a', es: 'b' }, 'x']), [{ nl: 'verhuurder', es: 'arrendador', note: 'n' }]);
  assert.equal(parseInterpreterReply('{"translation":"Hola","uncertain":["a",3],"clarify":""}').uncertain.length, 1);
  const notice = openingNotice('Ana <b>', 'JANUS');
  assert.match(notice.nl, /digitale tolk voor Ana b\./);
  assert.match(notice.nl, /zonder iets toe te voegen/);
  assert.doesNotMatch(openingNotice('').nl, /voor\s*\./);
});

test('caso privado: el expediente del intérprete se guarda en el caso pero no viaja a la pantalla', () => {
  const c = createPriorityCase({ id: 'caso-test', title: 'Prueba', ownerPrincipalId: 'p1', interpreterBrief: 'Línea 1\n\nLínea 2', interpreterGlossary: [{ nl: 'buurman', es: 'vecino' }, { nl: 'x' }] }, '2026-11-11T10:00:00Z');
  assert.equal(c.interpreterBrief, 'Línea 1\n\nLínea 2');
  assert.equal(c.interpreterGlossary?.length, 1);
  const view = caseView(c) as Record<string, unknown>;
  assert.equal(view.interpreterBrief, undefined);
  assert.deepEqual(view.interpreter, { ready: true, briefChars: 16, glossaryTerms: 1 });
});
