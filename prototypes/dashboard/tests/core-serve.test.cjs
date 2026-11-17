'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');

function availablePort() {
  return new Promise((resolve, reject) => {
    const sock = net.createServer();
    sock.listen(0, '127.0.0.1', () => {
      const port = sock.address().port;
      sock.close(() => resolve(port));
    });
    sock.once('error', reject);
  });
}

test('local bridge serves both dashboards and proxies only to local JANUS CORE', { timeout: 30000 }, async () => {
  const core = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/health') {
      res.end(JSON.stringify({ ok: true, service: 'janus-runtime' }));
    } else if (req.url === '/api/command' && req.method === 'POST') {
      const auth = req.headers.authorization || null;
      res.end(JSON.stringify({ runId: 'run-001', authReceived: auth === 'Bearer fake-for-test' }));
    } else {
      res.end(JSON.stringify({ ok: true, path: req.url }));
    }
  });
  const corePort = await availablePort();
  await new Promise((resolve) => core.listen(corePort, '127.0.0.1', resolve));
  const dashboardPort = await availablePort();
  const root = path.join(__dirname, '..');
  const child = spawn(process.execPath, [path.join(root, 'tools/serve-with-core.cjs')], {
    cwd: root, env: { ...process.env, JANUS_CORE_URL: 'http://127.0.0.1:' + corePort, JANUS_DASH_PORT: String(dashboardPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const base = 'http://127.0.0.1:' + dashboardPort;
    let ready = false;
    for (let i = 0; i < 90; i++) {
      if (child.exitCode !== null) throw new Error('Local dashboard bridge stopped: ' + child.exitCode);
      try {
        const r = await fetch(base + '/health');
        if (r.ok && (await r.json()).service === 'janus-runtime') { ready = true; break; }
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(ready, true, 'el Core es accesible desde el mismo origen');
    for (const variant of ['a', 'b']) {
      const r = await fetch(base + '/dashboard/' + variant);
      assert.equal(r.status, 200);
      assert.match(await r.text(), /janus-model-gateway|JanusGateway|JANUS/i);
    }
    const real = await fetch(base + '/api/command', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer fake-for-test', origin: base },
      body: '{"text":"una petición de prueba"}',
    });
    assert.equal((await real.json()).authReceived, true);
    const blocked = await fetch(base + '/api/command', {
      method: 'POST', headers: { origin: 'http://outsider.invalid', 'content-type': 'application/json' },
      body: '{"text":"no permitido"}',
    });
    assert.equal(blocked.status, 403);
  } finally {
    child.kill('SIGTERM');
    core.close();
  }
});
