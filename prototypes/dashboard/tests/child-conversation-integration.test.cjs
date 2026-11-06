'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function harness(policy = true) {
  const ctx = vm.createContext({
    window: {},
    Companion: {
      checkMessage(text) {
        return /me roban/i.test(text)
          ? { severity: 'importante', parentAlert: { summary: 'Revisión local', severity: 'importante' } }
          : { severity: 'ninguna' };
      }
    }
  });
  if (policy) vm.runInContext(read('lego/janus-family-guide/janus-child-safety.js'), ctx);
  vm.runInContext(read('lego/janus-family-guide/janus-child-conversation.js'), ctx);
  return ctx.window.JanusChildConversation;
}

test('sensitive messages use evidence-based response in the actual conversation bridge', () => {
  const bridge = harness();
  let fallbackCalls = 0;
  const fallback = () => { fallbackCalls++; return { say: ['generic'], safety: {} }; };
  const urgent = bridge.respond('Quiero hacerme daño', fallback);
  assert.equal(urgent.review, 'child-evidence-policy');
  assert.match(urgent.say[0], /adulto de confianza/);
  assert.equal(urgent.safety.parentAlert.severity, 'urgente');
  assert.equal(fallbackCalls, 0, 'must not return generic chat for urgent disclosure');

  const bullying = bridge.respond('Me insultan y me hacen bullying', fallback);
  assert.match(bullying.say[0], /profesor/);
  assert.equal(bullying.safety.parentAlert.severity, 'importante');

  const diagnosis = bridge.respond('¿Tengo TDAH?', fallback);
  assert.equal(diagnosis.requiresProfessional, true);
  assert.equal(diagnosis.safety.parentAlert, null);
  assert.match(diagnosis.say[0], /No puedo decir/);
  assert.equal(fallbackCalls, 0);
});

test('ordinary child chat preserves the existing companion and personality', () => {
  const bridge = harness();
  let calls = 0;
  const output = bridge.respond('Hoy aprendí matemáticas', () => {
    calls++; return { say: ['¡Qué bien!'], safety: { severity: 'ninguna' } };
  });
  assert.equal(calls, 1);
  assert.deepEqual(Array.from(output.say), ['¡Qué bien!']);
});

test('safety module missing blocks generic fallback instead of hiding a failure', () => {
  const bridge = harness(false);
  let calls = 0;
  const answer = bridge.respond('Hoy me siento triste', () => { calls++; return {say:['Todo bien']}; });
  assert.equal(calls, 0);
  assert.equal(answer.review, 'safety-module-unavailable');
  assert.match(answer.say[0], /adulto de confianza/);
});

test('local alerts persist only topic and severity, never private message', () => {
  const bridge = harness();
  const original = 'Me hacen daño en el recreo';
  const turn = bridge.respond(original, () => { throw new Error('should not be called'); });
  const stored = bridge.appendLocalAlert([], turn.safety.parentAlert, '06/11 21:00');
  assert.equal(stored.length, 1);
  const json = JSON.stringify(stored);
  assert.doesNotMatch(json, /recreo|Me hacen daño/);
  assert.equal(stored[0].severity, 'urgente');
  assert.match(stored[0].summary, /Revisión local pendiente/);

  // Malicious or accidental caller can never smuggle a raw quote into the notes.
  const injection = bridge.appendLocalAlert(stored, {
    severity: 'urgente',
    summary: 'Mi contraseña es 12345, no lo guardes'
  }, '06/11 21:01');
  assert.doesNotMatch(JSON.stringify(injection), /contraseña|12345/);
  assert.ok(injection[1].summary.includes('conversación sensible'));
  let state = injection;
  for (let i = 0; i < 30; i++) state = bridge.appendLocalAlert(state, turn.safety.parentAlert, '06/11 21:05');
  assert.equal(state.length, bridge.MAX_LOCAL_NOTES);
});

test('full A and B bundles include safeguards before the child UI, without extra network calls', () => {
  const build = read('build.cjs'), child = read('src/companero.js');
  const policyPath = "'lego/janus-family-guide/janus-child-safety.js'";
  const bridgePath = "'lego/janus-family-guide/janus-child-conversation.js'";
  const childPath = "'src/companero.js'";
  assert.ok(build.indexOf(policyPath) >= 0);
  assert.ok(build.indexOf(policyPath) < build.indexOf(bridgePath));
  assert.ok(build.indexOf(bridgePath) < build.indexOf(childPath));
  assert.match(child, /JanusChildConversation\.respond\(msg/);
  assert.match(child, /JanusChildConversation\.appendLocalAlert/);
  assert.match(child, /no se envían a nadie automáticamente/);
  assert.doesNotMatch(child, /la anima a contarlo y avisa a papá/);
  assert.match(child, /no tiene acceso autenticado/);
  const src = read('lego/janus-family-guide/janus-child-conversation.js');
  assert.doesNotMatch(src, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/);
});
