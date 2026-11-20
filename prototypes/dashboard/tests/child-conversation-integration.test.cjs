'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const code = read('lego/janus-family-guide/janus-child-safety.js') +
  '\n' + read('lego/janus-family-guide/janus-child-conversation.js');

function makeContext() {
  const ctx = { window: {}, Companion: { checkMessage: () => ({ severity: 'ninguna' }) } };
  vm.runInNewContext(code, ctx, { filename: 'janus-child-safety-and-chat.js' });
  return ctx;
}

test('companion critical disclosures are locally reviewed before legacy response; never sent to fallback', () => {
  const ctx = makeContext(); let calls = 0;
  const result = ctx.window.JanusChildConversation.respond('Quiero hacerme daño', () => {
    calls++; throw new Error('sensitive text must not enter generic completion');
  });
  assert.equal(calls, 0);
  assert.equal(result.review, 'child-evidence-policy');
  assert.equal(result.safety.severity, 'urgente');
  assert.ok(result.safety.parentAlert);
  assert.match(result.say[0], /adulto de confianza/);
  assert.equal(result.requiresProfessional, false);
  const notes = ctx.window.JanusChildConversation.appendLocalAlert([], result.safety.parentAlert, '20:00');
  assert.equal(notes.length, 1);
  assert.doesNotMatch(JSON.stringify(notes), /Quiero hacerme daño/);
  assert.match(notes[0].summary, /Revisión local pendiente/);
});

test('missing policy fails closed without contacting any service or inventing a parent notification', () => {
  const ctx = makeContext();
  delete ctx.window.JanusChildSafety;
  const r = ctx.window.JanusChildConversation.respond('hola', () => { throw new Error('must not call fallback'); });
  assert.equal(r.review, 'safety-module-unavailable');
  assert.match(r.say[0], /adulto de confianza/);
  assert.doesNotMatch(read('lego/janus-family-guide/janus-child-conversation.js'), /\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b/);
});

test('normal messages retain companion behavior while preventing raw disclosures in adult notes', () => {
  const ctx = makeContext();
  const r = ctx.window.JanusChildConversation.respond('Me gusta aprender matemáticas', () => ({
    say: ['¡Estupendo!'], safety: { parentAlert: null },
  }));
  assert.equal(r.say[0], '¡Estupendo!');
  const hostileAlert = { severity: 'importante', summary: 'Textual message with private data' };
  const notes = ctx.window.JanusChildConversation.appendLocalAlert([], hostileAlert, '21:00');
  assert.equal(notes.length, 1);
  assert.doesNotMatch(notes[0].summary, /Textual message/);
  const companion = read('src/companero.js');
  assert.match(companion, /JanusChildConversation\.respond\(msg/);
  assert.match(companion, /JanusChildConversation\.appendLocalAlert/);
  assert.match(read('build.cjs'), /lego\/janus-family-guide\/janus-child-conversation\.js/);
});
