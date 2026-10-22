import test from 'node:test';
import assert from 'node:assert/strict';
import { CodeRunnerRouter, WorkerJsCodeRunner } from '../packages/automation/src/code-runner.js';

const run = new WorkerJsCodeRunner();

test('código JS: transforma la entrada y devuelve JSON', async () => {
  const r = await run.run({ language: 'javascript', source: 'return { total: input.items.reduce((s, x) => s + x.eur, 0), n: input.items.length };', input: { items: [{ eur: 10 }, { eur: 5.5 }] } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.output, { total: 15.5, n: 2 });
});

test('código JS: console.log se captura y undefined se convierte en null', async () => {
  const r = await run.run({ language: 'javascript', source: 'console.log("hola", {a:1}); ' });
  assert.equal(r.ok, true);
  assert.equal(r.output, null);
  assert.deepEqual(r.logs, ['hola {"a":1}']);
});

test('código JS: sin process, require, fetch ni escapes por constructor', async () => {
  const probes = [
    'return typeof process;',
    'return typeof require;',
    'return typeof fetch;',
    'return typeof globalThis.process;',
    'return this.constructor.constructor("return process")();',
    'return (function(){}).constructor("return process")();',
    'return eval("1+1");',
  ];
  const results = await Promise.all(probes.map((source) => run.run({ language: 'javascript', source })));
  assert.equal(results[0]!.output, 'undefined');
  assert.equal(results[1]!.output, 'undefined');
  assert.equal(results[2]!.output, 'undefined');
  assert.equal(results[3]!.output, 'undefined');
  for (const r of results.slice(4)) assert.equal(r.ok, false, 'el escape debe fallar: ' + JSON.stringify(r));
});

test('código JS: bucle infinito y bomba de memoria se cortan', async () => {
  const loop = await run.run({ language: 'javascript', source: 'while (true) {}', timeoutMs: 200 });
  assert.equal(loop.ok, false);
  assert.match(loop.error ?? '', /tiempo|time|Script execution/i);
  const mem = await run.run({ language: 'javascript', source: 'const a = []; while (true) a.push(new Array(1e6).fill(1));', timeoutMs: 3000, memoryMb: 32 });
  assert.equal(mem.ok, false);
});

test('código JS: errores de sintaxis y salidas no válidas se informan sin romper', async () => {
  const bad = await run.run({ language: 'javascript', source: 'return {' });
  assert.equal(bad.ok, false);
  const vacio = await run.run({ language: 'javascript', source: '   ' });
  assert.equal(vacio.ok, false);
  const grande = await run.run({ language: 'javascript', source: 'return "x".repeat(400000);' });
  assert.equal(grande.ok, false);
  assert.match(grande.error ?? '', /demasiado grande/);
});

test('Python se declara no disponible (sin fingir)', async () => {
  const r = await new CodeRunnerRouter().run({ language: 'python', source: 'print(1)' });
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /Python/);
});
