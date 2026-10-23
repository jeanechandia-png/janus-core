import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '..');
const kit = join(root, 'scripts', 'tablet');
const shellScripts = ['install-termux.sh', 'start-janus.sh', 'status.sh'];

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
    const env = { ...process.env, HOME: dir, JANUS_APP_DIR: app, JANUS_DATA_DIR: join(dir, 'data'), JANUS_SECRETS_DIR: join(dir, 'sec'), JANUS_BACKUP_EVERY_S: '0', JANUS_RESTART_MAX_S: '1', PORT: '8799' };
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
