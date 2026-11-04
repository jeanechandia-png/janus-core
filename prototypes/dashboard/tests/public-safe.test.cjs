'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
test('Core-served dashboard excludes all local personal data, even when private files exist', { timeout: 25000 }, () => {
  const original = path.join(__dirname, '..');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'janus-dash-public-safe-'));
  try {
    const copy = path.join(tmp, 'dashboard');
    fs.cpSync(original, copy, { recursive: true, filter: (file) => !/[/\\]dist(?:[/\\]|$)/.test(file) && !/[/\\]node_modules(?:[/\\]|$)/.test(file) });
    fs.mkdirSync(path.join(copy, 'local'), { recursive: true });
    const marker = 'FAKE_SECRET_SHOULD_NEVER_REACH_CORE_HTML_8273';
    fs.writeFileSync(path.join(copy, 'local/names.json'), JSON.stringify({ __CLIENTE_IBA__: marker }));
    fs.writeFileSync(path.join(copy, 'local/real.js'), "const REAL = { sample: '" + marker + "' };\n");
    const safe = path.join(copy, 'dist', 'safe.html');
    const privateFile = path.join(copy, 'dist', 'private.html');
    const build = path.join(copy, 'build.cjs');
    execFileSync(process.execPath, [build, '--out', safe], {
      cwd: copy, env: { ...process.env, JANUS_DASH_PUBLIC_SAFE: '1' }, timeout: 20000,
    });
    assert.ok(fs.existsSync(safe));
    assert.doesNotMatch(fs.readFileSync(safe, 'utf8'), new RegExp(marker));
    execFileSync(process.execPath, [build, '--out', privateFile], {
      cwd: copy, env: { ...process.env, JANUS_DASH_PUBLIC_SAFE: '0' }, timeout: 20000,
    });
    assert.match(fs.readFileSync(privateFile, 'utf8'), new RegExp(marker),
      'control: el marcador debe existir solo en build local privado');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
