'use strict';
/** Tests for same-origin Core Bridge; no network, keys or paid providers. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../lego/janus-model-gateway/janus-model-gateway.js'), 'utf8');
const ORIGIN = 'http://127.0.0.1:8765';
function makeRuntime({ ok = true, authorized = true, withClaude = true } = {}) {
  const calls = [];
  let sampleCalls = 0;
  const sample = () => { sampleCalls++; return { text: 'Claude externo' }; };
  const fetchMock = async (url, init = {}) => {
    calls.push({ path: new URL(url).pathname, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    if (String(url).endsWith('/health')) return {
      ok: true, json: async () => ({ ok, service: ok ? 'janus-runtime' : 'other-service' }),
    };
    if (String(url).endsWith('/api/command')) return authorized
      ? { ok: true, status: 200, json: async () => ({ runId: 'run-001' }) }
      : { ok: false, status: 403, json: async () => ({ error: 'forbidden' }) };
    if (String(url).includes('/api/runs/run-001')) return {
      ok: true, json: async () => ({ snapshot: { status: 'completed', result: { text: 'Proceso real completado por JANUS CORE' } } }),
    };
    throw Error('URL inesperada: ' + url);
  };
  class FakeEventSource { constructor() {} close() {} }
  const location = { protocol: 'http:', origin: ORIGIN, href: ORIGIN + '/dashboard/a' };
  const window = {
    location, fetch: fetchMock, addEventListener() {},
    sessionStorage: { getItem(key) { return key === 'janus.founder.session' ? 'token-session-test' : null; } },
    ...(withClaude ? { claude: { use: async () => sample } } : {}),
  };
  const sandbox = { window, fetch: fetchMock, URL, EventSource: FakeEventSource, setTimeout, clearTimeout, setInterval, clearInterval, console };
  vm.runInNewContext(code, sandbox, { filename: 'janus-model-gateway.js' });
  return { gateway: window.JanusGateway, calls, get sampleCalls() { return sampleCalls; } };
}
test('only a verified janus-runtime origin activates the core', async () => {
  const a = makeRuntime({ ok: true });
  assert.equal(await a.gateway.probeCore(), true);
  assert.equal(a.gateway.coreConnected(), true);
  assert.equal(a.gateway.status().find(x => x.id === 'core').available, true);
  const b = makeRuntime({ ok: false });
  assert.equal(await b.gateway.probeCore(), false);
  assert.equal(b.gateway.coreConnected(), false);
});
test('core command uses session bearer, only last user text, and real completion', async () => {
  const r = makeRuntime();
  await r.gateway.probeCore();
  const answer = await r.gateway.ask({
    system: 'SYSTEM PROMPT FROM PREVIEW (never forwarded to the Core)',
    messages: [
      { role: 'user', content: 'antiguo' },
      { role: 'assistant', content: 'anterior' },
      { role: 'user', content: 'Verifica calendario' },
    ],
    images: [{ type: 'image/jpeg' }],
  });
  assert.equal(answer.via, 'core');
  assert.match(answer.text, /Proceso real completado/);
  assert.equal(answer.imagesSent, 0);
  const command = r.calls.find(x => x.path === '/api/command');
  assert.ok(command);
  assert.equal(command.headers.authorization, 'Bearer token-session-test');
  assert.equal(JSON.parse(command.body).text, 'Verifica calendario');
  assert.doesNotMatch(command.body, /SYSTEM PROMPT FROM PREVIEW/);
  assert.equal(r.sampleCalls, 0);
});
test('authentication denial never leaks task contents to Claude fallback', async () => {
  const r = makeRuntime({ authorized: false, withClaude: true });
  await r.gateway.probeCore();
  const answer = await r.gateway.ask({ messages: [{ role: 'user', content: 'Información privada' }] });
  assert.equal(answer.via, 'core-error');
  assert.match(answer.text, /sesión autorizada/);
  assert.equal(r.sampleCalls, 0);
});
test('Core URL rejects all other origins even when URL looks like localhost', () => {
  const r = makeRuntime();
  assert.throws(() => r.gateway.setCoreUrl('https://janus-attacker.example/'), /mismo origen/);
  assert.throws(() => r.gateway.setCoreUrl('http://127.0.0.1:8765@attacker.example/'), /mismo origen/);
  assert.throws(() => r.gateway.setCoreUrl('http://127.0.0.1:8765/private'), /mismo origen/);
});
