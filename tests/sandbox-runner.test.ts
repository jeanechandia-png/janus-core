import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChangePipeline, ProcessSandboxDriver, dockerRunArgs, selectSandboxDriver, validateChangePath, type SandboxDriver } from '../packages/core/src/sandbox-runner.js';

const sh = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { PATH: process.env.PATH!, HOME: tmpdir(), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'janus-repo-'));
  sh(dir, 'init', '--quiet', '-b', 'main');
  writeFileSync(join(dir, 'suma.js'), 'module.exports = (a, b) => a + b;\n');
  writeFileSync(join(dir, 'prueba.js'), "const suma = require('./suma.js');\nif (suma(2, 3) !== 5) { console.error('suma rota'); process.exit(1); }\nconsole.log('pruebas ok');\n");
  writeFileSync(join(dir, '.gitignore'), '.env\n');
  writeFileSync(join(dir, '.env'), 'CLAVE_SECRETA=no-debe-salir\n');
  sh(dir, 'add', '-A'); sh(dir, 'commit', '--quiet', '-m', 'inicio');
  return dir;
}
const pipeline = () => new ChangePipeline({ driver: new ProcessSandboxDriver(), trailers: ['Preparado-por: JANUS'] });

test('un cambio que pasa las pruebas queda como commit preparado en una rama propia; el origen no se toca', async () => {
  const dir = repo(); const head = sh(dir, 'rev-parse', 'HEAD');
  const prepared = await pipeline().propose({ id: 'doc-suma', repoDir: dir, summary: 'Documenta la función suma', changes: [{ path: 'suma.js', content: '// Suma dos números.\nmodule.exports = (a, b) => a + b;\n' }], checks: [['node', 'prueba.js']] });
  assert.equal(prepared.status, 'ready'); assert.equal(prepared.branch, 'janus/change-doc-suma'); assert.match(prepared.commit!, /^[0-9a-f]{40}$/);
  assert.equal(prepared.sandbox!.ok, true); assert.match(prepared.sandbox!.steps[0]!.stdout, /pruebas ok/); assert.equal(prepared.sandbox!.isolation, 'process');
  assert.match(sh(prepared.workdir!, 'log', '-1', '--format=%B'), /Documenta la función suma[\s\S]*sandbox \(process, aislamiento: process\)[\s\S]*Preparado-por: JANUS/);
  assert.equal(sh(dir, 'rev-parse', 'HEAD'), head, 'el repositorio origen sigue igual'); assert.equal(sh(dir, 'status', '--porcelain'), '');
  assert.equal(existsSync(join(prepared.workdir!, '.env')), false, 'los secretos locales no entran en el clon');
  pipeline().discard(prepared); assert.equal(existsSync(prepared.workdir!), false);
  rmSync(dir, { recursive: true, force: true });
});

test('si las pruebas fallan no hay commit: se devuelven los registros y se borra el clon', async () => {
  const dir = repo();
  const prepared = await pipeline().propose({ id: 'rompe-suma', repoDir: dir, summary: 'Cambio defectuoso', changes: [{ path: 'suma.js', content: 'module.exports = (a, b) => a - b;\n' }], checks: [['node', 'prueba.js'], ['node', '-e', 'console.log("no debe ejecutarse")']] });
  assert.equal(prepared.status, 'rejected'); assert.equal(prepared.commit, undefined); assert.equal(prepared.workdir, undefined);
  assert.equal(prepared.sandbox!.steps.length, 1, 'el primer fallo detiene el resto'); assert.match(prepared.sandbox!.steps[0]!.stderr, /suma rota/); assert.match(prepared.reason!, /código 1/);
  assert.equal((await pipeline().propose({ id: 'sin-cambio', repoDir: dir, summary: 'Nada', changes: [{ path: 'suma.js', content: 'module.exports = (a, b) => a + b;\n' }], checks: [['node', 'prueba.js']] })).reason, 'el cambio no modifica nada');
  rmSync(dir, { recursive: true, force: true });
});

test('el código probado no ve las variables de JANUS y un bucle infinito se corta', async () => {
  const dir = repo(); process.env.JANUS_CREDENTIAL_VAULT_KEY = 'clave-de-prueba-que-no-debe-filtrarse';
  writeFileSync(join(dir, 'espia.js'), 'console.log(JSON.stringify(Object.keys(process.env).filter((k) => /JANUS|KEY|TOKEN|SECRET/i.test(k))));\n'); sh(dir, 'add', '-A'); sh(dir, 'commit', '--quiet', '-m', 'espia');
  const seen = await pipeline().propose({ id: 'entorno', repoDir: dir, summary: 'Entorno', changes: [{ path: 'nota.txt', content: 'x\n' }], checks: [['node', 'espia.js']] });
  assert.equal(seen.sandbox!.steps[0]!.stdout.trim(), '[]'); pipeline().discard(seen);
  const slow = await pipeline().propose({ id: 'bucle', repoDir: dir, summary: 'Bucle', changes: [{ path: 'nota.txt', content: 'y\n' }], checks: [['node', '-e', 'setInterval(() => {}, 1000)']], timeoutMs: 1200 });
  assert.equal(slow.status, 'rejected'); assert.equal(slow.sandbox!.steps[0]!.timedOut, true); assert.match(slow.reason!, /tiempo/);
  delete process.env.JANUS_CREDENTIAL_VAULT_KEY; rmSync(dir, { recursive: true, force: true });
});

test('rutas protegidas: ni secretos, ni .git, ni salir del repositorio; y nunca sin comprobaciones', async () => {
  for (const bad of ['../fuera.txt', '/etc/passwd', '.git/config', '.env', 'config/.env.production', 'claves/id_rsa', 'cert/servidor.pem', 'a/../../b', 'secrets/x.json']) assert.throws(() => validateChangePath(bad), /ruta/, bad);
  assert.equal(validateChangePath('src/./app.js'), 'src/app.js');
  const dir = repo();
  await assert.rejects(pipeline().propose({ id: 'sin-pruebas', repoDir: dir, summary: 'x', changes: [{ path: 'a.txt', content: 'x' }], checks: [] }), /without checks/);
  await assert.rejects(pipeline().propose({ id: 'fuga', repoDir: dir, summary: 'x', changes: [{ path: '.env', content: 'X=1' }], checks: [['node', 'prueba.js']] }), /protegida/);
  await assert.rejects(pipeline().propose({ id: 'orden', repoDir: dir, summary: 'x', changes: [{ path: 'a.txt', content: 'x' }], checks: [['sh -c "rm -rf /"']] }), /executable/);
  rmSync(dir, { recursive: true, force: true });
});

test('publicar exige aprobación humana y nunca empuja a una rama protegida', async () => {
  const dir = repo(); const remote = mkdtempSync(join(tmpdir(), 'janus-remote-')); sh(remote, 'init', '--quiet', '--bare');
  const p = pipeline(); const prepared = await p.propose({ id: 'nota', repoDir: dir, summary: 'Añade una nota', changes: [{ path: 'NOTA.md', content: '# Nota\n' }], checks: [['node', 'prueba.js']] });
  assert.throws(() => p.publish(prepared, { remoteUrl: remote, approval: { approvalId: 'approval_x', approved: false } }), /aprobación/);
  assert.throws(() => p.publish(prepared, { remoteUrl: remote, approval: { approvalId: 'inventado', approved: true } }), /aprobación/);
  assert.throws(() => p.publish({ ...prepared, branch: 'main' }, { remoteUrl: remote, approval: { approvalId: 'approval_1', approved: true } }), /protegidas/);
  assert.equal(p.publish(prepared, { remoteUrl: remote, approval: { approvalId: 'approval_1', approved: true } }).ok, true);
  assert.equal(sh(remote, 'branch', '--list').trim(), 'janus/change-nota', 'solo existe la rama del cambio; main no se toca');
  assert.equal(readFileSync(join(prepared.workdir!, 'NOTA.md'), 'utf8'), '# Nota\n');
  p.discard(prepared); rmSync(dir, { recursive: true, force: true }); rmSync(remote, { recursive: true, force: true });
});

test('contenedor: sin red, solo lectura, sin privilegios y con límites; no se cae al proceso sin avisar', () => {
  const args = dockerRunArgs({ image: 'node:22-slim' }, { workdir: '/tmp/x', readOnlyMounts: [{ from: '/repo/node_modules', to: 'node_modules' }] }, ['npm', 'test']);
  const flat = args.join(' ');
  for (const must of ['--rm', '--network none', '--read-only', '--cap-drop ALL', 'no-new-privileges', '--pids-limit 256', '--memory 1g', '--user 1000:1000', '-v /tmp/x:/work:rw', '-v /repo/node_modules:/work/node_modules:ro']) assert.ok(flat.includes(must), must);
  assert.deepEqual(args.slice(-3), ['node:22-slim', 'npm', 'test']);
  assert.throws(() => dockerRunArgs({ image: 'node; rm -rf /' }, { workdir: '/tmp/x' }, ['npm']), /image/);
  const noDocker: SandboxDriver = { name: 'docker', isolation: 'container', available: () => false, run: async () => { throw new Error('no'); } };
  assert.equal(selectSandboxDriver([noDocker, new ProcessSandboxDriver()]).name, 'process');
  assert.throws(() => selectSandboxDriver([noDocker, new ProcessSandboxDriver()], { requireContainer: true }), /contenedor/);
});
