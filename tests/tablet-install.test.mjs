import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { configureLocal } from '../scripts/tablet/configure-local.mjs';
import { loadEnvFile } from '../scripts/lib/env-file.mjs';

const root = resolve(import.meta.dirname, '..');
const kit = join(root, 'scripts/tablet');
const keypair = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const temp = () => mkdtempSync(join(tmpdir(), 'janus-install-'));
const load = file => { const data = {}; loadEnvFile(file, data); return data; };

test('tablet config: local encryption, stable secrets and custom boot paths; only public P-256 enrollment', () => {
  const dir = temp();
  try {
    const env = { HOME: dir, JANUS_APP_DIR: root, JANUS_DATA_DIR: join(dir, 'data space'), JANUS_SECRETS_DIR: join(dir, "private's space") };
    const file = join(env.JANUS_SECRETS_DIR, 'janus.env');
    assert.equal(configureLocal(env).founderConfigured, false);
    const first = load(file);
    assert.equal(Buffer.from(first.JANUS_CREDENTIAL_VAULT_KEY, 'base64').length, 32);
    assert.equal(Buffer.from(first.JANUS_PUSH_VAPID_PRIVATE_KEY, 'base64url').length, 32);
    assert.equal(first.JANUS_DB, join(env.JANUS_DATA_DIR, 'janus.db'));
    assert.equal(first.JANUS_BIND_HOST, '127.0.0.1');
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(statSync(env.JANUS_DATA_DIR).mode & 0o777, 0o700);
    configureLocal(env);
    assert.deepEqual(load(file), first, 'idempotent: no rekeying');
    const keys = keypair(); const publicFile = join(dir, 'public.pem');
    writeFileSync(publicFile, keys.publicKey);
    assert.equal(configureLocal(env, publicFile).founderConfigured, true);
    assert.equal(load(file).JANUS_FOUNDER_PUBLIC_KEY_PEM, keys.publicKey);
    const enrolled = readFileSync(file, 'utf8');
    writeFileSync(publicFile, keypair().publicKey);
    assert.throws(() => configureLocal(env, publicFile), /Ya existe otra llave/);
    assert.equal(readFileSync(file, 'utf8'), enrolled);
    writeFileSync(publicFile, keys.privateKey);
    assert.throws(() => configureLocal(env, publicFile), /PÚBLICA/);
    assert.equal(readFileSync(file, 'utf8'), enrolled);
    const bin = join(dir, 'bin'); mkdirSync(bin);
    const output = join(dir, 'boot-paths');
    writeFileSync(join(bin, 'sh'), '#!/bin/sh\nprintf "%s\\n" "$JANUS_APP_DIR" "$JANUS_DATA_DIR" "$JANUS_SECRETS_DIR" "$JANUS_ENV_FILE" > "$BOOT_CAPTURE"\n');
    chmodSync(join(bin, 'sh'), 0o755);
    const boot = spawnSync('/bin/sh', ['-c', readFileSync(join(dir, '.termux/boot/janus-start.sh'), 'utf8') + '\nwait\n'], { env: { PATH: bin, BOOT_CAPTURE: output }, encoding: 'utf8' });
    assert.equal(boot.status, 0, boot.stderr);
    assert.deepEqual(readFileSync(output, 'utf8').trim().split('\n'), [root, env.JANUS_DATA_DIR, env.JANUS_SECRETS_DIR, file]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('tablet installer: fresh install and fast-forward update preserve data; dirty/divergent source is refused', () => {
  const dir = temp();
  try {
    const remote = join(dir, 'remote'); mkdirSync(remote);
    const git = (...args) => {
      const r = spawnSync('git', ['-C', remote, ...args], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
    };
    git('init', '-q', '-b', 'main'); git('config', 'user.name', 'Tablet test'); git('config', 'user.email', 'tablet@example.invalid');
    mkdirSync(join(remote, 'scripts/tablet'), { recursive: true });
    writeFileSync(join(remote, 'scripts/tablet/configure-local.mjs'), `import { configureLocal } from ${JSON.stringify(pathToFileURL(join(kit, 'configure-local.mjs')).href)}; configureLocal();\n`);
    writeFileSync(join(remote, '.env.example'), 'JANUS_DB=data/janus.db\nJANUS_CREDENTIAL_VAULT_KEY=\n');
    writeFileSync(join(remote, '.gitignore'), 'node_modules\n');
    git('add', '.'); git('commit', '-qm', 'initial fixture');
    const first = git('rev-parse', 'HEAD');
    const bin = join(dir, 'bin'); mkdirSync(bin);
    const app = join(dir, 'home/janus-core');
    const calls = join(dir, 'npm-calls');
    writeFileSync(join(bin, 'npm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$NPM_CAPTURE"\nif [ "$1" = "ci" ]; then ln -s "$FIXTURE_MODULES" "$JANUS_APP_DIR/node_modules" 2>/dev/null || true; fi\n');
    chmodSync(join(bin, 'npm'), 0o755);
    const env = { ...process.env, HOME: join(dir, 'home'), JANUS_APP_DIR: app, JANUS_REPO_URL: remote, JANUS_REF: 'main', JANUS_ALLOW_NON_TERMUX: '1', JANUS_SKIP_PKG: '1', PATH: `${bin}:${process.env.PATH}`, NPM_CAPTURE: calls, FIXTURE_MODULES: join(root, 'node_modules') };
    delete env.JANUS_ENV_FILE; delete env.JANUS_DATA_DIR; delete env.JANUS_SECRETS_DIR;
    const install = () => spawnSync('sh', [join(kit, 'install-termux.sh')], { env, encoding: 'utf8', timeout: 30000 });
    let result = install(); assert.equal(result.status, 0, result.stdout + result.stderr);
    const file = join(env.HOME, 'janus-secrets/janus.env');
    const config = readFileSync(file, 'utf8');
    const memory = join(env.HOME, 'janus-data/memory.fixture'); writeFileSync(memory, 'keep memory');
    const head = () => spawnSync('git', ['-C', app, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    assert.equal(head(), first);
    const commands = readFileSync(calls, 'utf8');
    assert.match(commands, /ci --no-audit --no-fund/);
    assert.match(commands, /run dashboard:build/);
    assert.match(commands, /run tablet:check/);
    writeFileSync(join(app, 'pending.txt'), 'uncommitted agent work');
    result = install(); assert.notEqual(result.status, 0); assert.match(result.stderr, /trabajo local sin guardar/);
    assert.equal(readFileSync(join(app, 'pending.txt'), 'utf8'), 'uncommitted agent work');
    assert.equal(readFileSync(calls, 'utf8'), commands, 'refusal occurs before installing dependencies');
    rmSync(join(app, 'pending.txt'));
    writeFileSync(join(remote, 'next.txt'), 'new remote change'); git('add', '.'); git('commit', '-qm', 'next fixture');
    result = install(); assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(head(), git('rev-parse', 'HEAD'));
    assert.equal(readFileSync(file, 'utf8'), config);
    assert.equal(readFileSync(memory, 'utf8'), 'keep memory');
    env.JANUS_REF = first;
    result = install(); assert.notEqual(result.status, 0); assert.match(result.stderr, /no continúa/);
    assert.equal(head(), git('rev-parse', 'HEAD'), 'no rollback');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
