import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '..');
const kit = join(root, 'scripts', 'tablet');
const shellScripts = ['install-termux.sh', 'start-janus.sh', 'stop-janus.sh', 'status.sh', 'faceid-setup.sh', 'update-janus.sh'];

const tmp = () => mkdtempSync(join(tmpdir(), 'janus-tablet-'));
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

function makeDb(path: string): void {
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE memoria (id INTEGER PRIMARY KEY, texto TEXT)');
  db.prepare('INSERT INTO memoria (texto) VALUES (?)').run('dato de prueba');
  db.close();
}

test('los scripts de la tablet tienen sintaxis POSIX válida, shebang de Termux y no llevan secretos', () => {
  for (const name of shellScripts) {
    const path = join(kit, name);
    const text = readFileSync(path, 'utf8');
    assert.ok(text.startsWith('#!/data/data/com.termux/files/usr/bin/sh\n'), `${name}: shebang de Termux`);
    const syntax = spawnSync('sh', ['-n', path], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, `${name}: ${syntax.stderr}`);
    assert.doesNotMatch(text, /(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer\s+[A-Za-z0-9._-]{20,})/, `${name}: sin secretos`);
  }
  assert.doesNotMatch(readFileSync(join(kit, 'backup-db.mjs'), 'utf8'), /(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)/);
});

test('el instalador se niega a correr fuera de Termux (no toca el sistema por error)', () => {
  const result = spawnSync('sh', [join(kit, 'install-termux.sh')], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', HOME: tmp() } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dentro de Termux/);
});

test('copia de seguridad: consistente, verificada, con rotación y sin base de datos no hace nada', () => {
  const dir = tmp();
  try {
    const dbPath = join(dir, 'janus.db');
    const env: NodeJS.ProcessEnv = { ...process.env, JANUS_DB: dbPath, JANUS_BACKUP_KEEP: '2' };
    delete env.JANUS_ENV_FILE;
    const none = spawnSync(process.execPath, [join(kit, 'backup-db.mjs')], { encoding: 'utf8', env });
    assert.equal(none.status, 0);
    assert.match(none.stdout, /nada que copiar/);
    assert.equal(existsSync(join(dir, 'backups')), false);

    makeDb(dbPath);
    for (const stamp of ['20261023-010000', '20261024-010000', '20261025-010000']) {
      const run = spawnSync(process.execPath, [join(kit, 'backup-db.mjs')], { encoding: 'utf8', env: { ...env, JANUS_BACKUP_STAMP: stamp } });
      assert.equal(run.status, 0, run.stderr);
    }
    const copies = readdirSync(join(dir, 'backups')).sort();
    assert.deepEqual(copies, ['janus-20261024-010000.db', 'janus-20261025-010000.db'], 'conserva solo las 2 últimas');
    const copy = new DatabaseSync(join(dir, 'backups', copies[1]!), { readOnly: true });
    assert.equal((copy.prepare('SELECT texto FROM memoria').get() as { texto: string }).texto, 'dato de prueba');
    assert.equal(Object.values(copy.prepare('PRAGMA integrity_check').get() as object)[0], 'ok');
    copy.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('copia de seguridad: el envío remoto está inactivo por defecto y, si se configura, usa rclone copy con el archivo verificado', () => {
  const dir = tmp();
  try {
    const dbPath = join(dir, 'janus.db');
    makeDb(dbPath);
    const bin = join(dir, 'bin'); mkdirSync(bin);
    const calls = join(dir, 'rclone-calls.txt');
    writeFileSync(join(bin, 'rclone'), `#!/bin/sh\necho "$@" >> "${calls}"\n`); chmodSync(join(bin, 'rclone'), 0o755);
    const base: NodeJS.ProcessEnv = { ...process.env, JANUS_DB: dbPath, JANUS_BACKUP_STAMP: '20261023-020000', PATH: `${bin}:${process.env.PATH ?? ''}` };
    delete base.JANUS_ENV_FILE;
    delete base.JANUS_BACKUP_RCLONE_REMOTE;
    assert.equal(spawnSync(process.execPath, [join(kit, 'backup-db.mjs')], { encoding: 'utf8', env: base }).status, 0);
    assert.equal(existsSync(calls), false, 'sin destino configurado no se llama a rclone');
    const withRemote = spawnSync(process.execPath, [join(kit, 'backup-db.mjs')], { encoding: 'utf8', env: { ...base, JANUS_BACKUP_STAMP: '20261023-030000', JANUS_BACKUP_RCLONE_REMOTE: 'gdrive-cifrado:janus' } });
    assert.equal(withRemote.status, 0, withRemote.stderr);
    assert.match(readFileSync(calls, 'utf8'), /^copy .*janus-20261023-030000\.db gdrive-cifrado:janus\n$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('supervisor: pasa la configuración, reinicia el runtime si se cae, admite una sola instancia y limpia el candado al parar', async () => {
  const dir = tmp();
  try {
    const app = join(dir, 'app'); mkdirSync(join(app, 'scripts'), { recursive: true });
    const marks = join(dir, 'arranques.txt');
    // Runtime de mentira: anota con qué variables se le llama y se cae enseguida.
    writeFileSync(join(app, 'scripts', 'start-local.mjs'), `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(marks)}, [process.env.PORT, process.env.JANUS_ENV_FILE].join('|') + '\\n');\nprocess.exit(1);\n`);
    const env = { ...process.env, HOME: dir, JANUS_APP_DIR: app, JANUS_DATA_DIR: join(dir, 'data'), JANUS_SECRETS_DIR: join(dir, 'sec'), JANUS_BACKUP_EVERY_S: '0', JANUS_UPDATE_EVERY_S: '0', JANUS_RESTART_MAX_S: '1', PORT: '8799' };
    const supervisor = spawn('sh', [join(kit, 'start-janus.sh')], { env, stdio: 'ignore' });
    await sleep(3500);

    const second = spawnSync('sh', [join(kit, 'start-janus.sh')], { encoding: 'utf8', env });
    assert.equal(second.status, 0);
    assert.match(second.stdout, /ya está en marcha/, 'una segunda instancia no arranca');

    const lines = readFileSync(marks, 'utf8').trim().split('\n');
    assert.ok(lines.length >= 2, `el runtime se reinició (${lines.length} arranques)`);
    assert.equal(lines[0], `8799|${join(dir, 'sec', 'janus.env')}`);
    assert.ok(existsSync(join(dir, 'data', 'janus.lock')), 'candado presente mientras corre');

    supervisor.kill('SIGTERM');
    await new Promise((done) => supervisor.once('exit', done));
    await sleep(200);
    assert.equal(existsSync(join(dir, 'data', 'janus.lock')), false, 'al parar se libera el candado');
    assert.match(readFileSync(join(dir, 'data', 'logs', 'janus.log'), 'utf8'), /el runtime terminó \(código 1/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('actualización automática: solo avanza, compila, se reintenta si falla y nunca toca cambios locales ni ramas divergentes', () => {
  const dir = tmp();
  try {
    const remote = join(dir, 'remote'); const app = join(dir, 'app'); const marks = join(dir, 'builds.txt');
    const run = (cwd: string, ...args: string[]) => { const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
    mkdirSync(remote);
    run(remote, 'init', '-q', '-b', 'main'); run(remote, 'config', 'user.email', 't@t'); run(remote, 'config', 'user.name', 't');
    const pkg = (ok: boolean) => JSON.stringify({ name: 'x', private: true, scripts: { 'dashboard:build': ok ? 'node build.cjs' : 'node -e "process.exit(1)"' } });
    writeFileSync(join(remote, 'build.cjs'), `require('node:fs').appendFileSync(${JSON.stringify(marks)}, 'build\\n');\n`);
    writeFileSync(join(remote, 'package.json'), pkg(true)); run(remote, 'add', '.'); run(remote, 'commit', '-qm', 'v1');
    const r = spawnSync('git', ['clone', '-q', remote, app], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr);
    writeFileSync(join(app, '.git', 'janus-built'), run(app, 'rev-parse', 'HEAD') + '\n');
    const update = () => spawnSync('sh', [join(kit, 'update-janus.sh')], { encoding: 'utf8', env: { ...process.env, HOME: dir, JANUS_APP_DIR: app, JANUS_REPO_URL: remote } }).status;

    assert.equal(update(), 10, 'al día: no hace nada');
    writeFileSync(join(remote, 'nuevo.txt'), 'v2'); run(remote, 'add', '.'); run(remote, 'commit', '-qm', 'v2');
    assert.equal(update(), 0, 'versión nueva: avanza y compila');
    assert.equal(run(app, 'rev-parse', 'HEAD'), run(remote, 'rev-parse', 'HEAD'));
    assert.equal(readFileSync(marks, 'utf8'), 'build\n');
    assert.equal(update(), 10);

    writeFileSync(join(remote, 'package.json'), pkg(false)); run(remote, 'commit', '-qam', 'v3 rota');
    assert.equal(update(), 30, 'compilación rota: avisa y sigue la versión en marcha');
    assert.equal(update(), 30, 'se reintenta en la siguiente vuelta, no se da por hecha');
    writeFileSync(join(remote, 'package.json'), pkg(true)); run(remote, 'commit', '-qam', 'v4 arreglada');
    assert.equal(update(), 0);

    writeFileSync(join(app, 'local.txt'), 'trabajo de Jean');
    writeFileSync(join(remote, 'otro.txt'), 'v5'); run(remote, 'add', '.'); run(remote, 'commit', '-qm', 'v5');
    assert.equal(update(), 20, 'cambios locales: no se toca nada');
    assert.equal(readFileSync(join(app, 'local.txt'), 'utf8'), 'trabajo de Jean');
    rmSync(join(app, 'local.txt'));

    run(remote, 'reset', '-q', '--hard', 'HEAD~2'); writeFileSync(join(remote, 'rama.txt'), 'divergente'); run(remote, 'add', '.'); run(remote, 'commit', '-qm', 'divergente');
    const before = run(app, 'rev-parse', 'HEAD');
    assert.equal(update(), 20, 'historia divergente: no retrocede ni fuerza');
    assert.equal(run(app, 'rev-parse', 'HEAD'), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
