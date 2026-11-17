/**
 * Automejora con ejecución segura (pilar 2 de la arquitectura anti-obsolescencia).
 *
 * Regla: JANUS puede proponer cambios a su propio código o a las plataformas de InfinitySeed, pero nada llega a un
 * repositorio central sin pasar antes por un entorno efímero y aislado, con sus registros, y sin la aprobación humana.
 *
 *   1. `ChangePipeline.propose`  clona el repositorio (solo lo versionado: nunca .env ni secretos locales),
 *                                aplica el cambio en el clon y ejecuta las comprobaciones en el sandbox.
 *   2. Si TODO pasa               deja preparado un commit en una rama `janus/change-…` del clon. Nada más.
 *   3. `ChangePipeline.publish`  empuja esa rama (nunca main/master/production) y solo con una aprobación HITL.
 *
 * Aislamiento (se declara en cada resultado, no se presume):
 *   DockerSandboxDriver   contenedor sin red, sistema de solo lectura, sin privilegios, con límites de CPU/memoria/tiempo.
 *   ProcessSandboxDriver  proceso hijo en carpeta temporal con el entorno limpio. NO es una frontera de seguridad:
 *                         sirve para pruebas propias y de confianza donde no hay Docker (p. ej. la tablet Android).
 *   Un servicio externo (E2B u otro) entra implementando `SandboxDriver`; no se incluye porque es de pago.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, sep } from 'node:path';

export interface SandboxStep {
  argv: string[];
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  /** Final de la salida (acotado). Es lo que se guarda como evidencia. */
  stdout: string;
  stderr: string;
}

export interface SandboxResult {
  ok: boolean;
  driver: string;
  isolation: 'container' | 'process';
  steps: SandboxStep[];
}

export interface SandboxRun {
  /** Carpeta de trabajo (ya es una copia efímera). */
  workdir: string;
  /** Comandos como listas de argumentos: sin intérprete de órdenes, sin interpolación. */
  commands: readonly (readonly string[])[];
  timeoutMs?: number;
  /** Carpetas de dependencias que se montan en solo lectura (p. ej. node_modules del repositorio origen). */
  readOnlyMounts?: ReadonlyArray<{ from: string; to: string }>;
}

export interface SandboxDriver {
  readonly name: string;
  readonly isolation: 'container' | 'process';
  available(): boolean;
  run(run: SandboxRun): Promise<SandboxResult>;
}

const TAIL = 6000;
const tail = (text: string): string => (text.length > TAIL ? `…${text.slice(-TAIL)}` : text);

function assertCommands(commands: SandboxRun['commands']): void {
  if (!commands.length || commands.length > 20) throw new Error('sandbox needs between 1 and 20 commands');
  for (const argv of commands) {
    if (!argv.length || argv.some((part) => typeof part !== 'string' || part.length > 2000 || part.includes('\0'))) throw new Error('sandbox command is not valid');
    if (!/^[A-Za-z0-9_./-]+$/.test(argv[0]!)) throw new Error(`sandbox executable is not valid: ${argv[0]!.slice(0, 40)}`);
  }
}

function execute(file: string, args: string[], options: { cwd?: string; env: NodeJS.ProcessEnv; timeoutMs: number }): Promise<Omit<SandboxStep, 'argv'>> {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '', stderr = '', timedOut = false, settled = false;
    const child = spawn(file, args, { cwd: options.cwd, env: options.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const done = (exitCode: number | null) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ exitCode, durationMs: Date.now() - started, timedOut, stdout: tail(stdout), stderr: tail(stderr) }); };
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid!, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* ya terminó */ } } }, options.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { stdout = (stdout + chunk.toString('utf8')).slice(-TAIL * 2); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-TAIL * 2); });
    child.on('error', (error) => { stderr += `\n${error.message}`; done(null); });
    child.on('close', (code) => done(code));
  });
}

async function runSteps(driver: SandboxDriver, run: SandboxRun, launch: (argv: readonly string[], timeoutMs: number) => Promise<Omit<SandboxStep, 'argv'>>): Promise<SandboxResult> {
  assertCommands(run.commands);
  const budget = Math.max(1000, Math.min(30 * 60_000, run.timeoutMs ?? 5 * 60_000));
  const steps: SandboxStep[] = [];
  let left = budget;
  for (const argv of run.commands) {
    const step = await launch(argv, Math.max(1000, left));
    steps.push({ argv: [...argv], ...step });
    left -= step.durationMs;
    if (step.exitCode !== 0 || step.timedOut || left <= 0) break; // el primer fallo detiene el resto
  }
  return { ok: steps.length === run.commands.length && steps.every((step) => step.exitCode === 0 && !step.timedOut), driver: driver.name, isolation: driver.isolation, steps };
}

/** Proceso hijo con entorno limpio. Aislamiento débil: úsese solo con código propio. */
export class ProcessSandboxDriver implements SandboxDriver {
  readonly name = 'process';
  readonly isolation = 'process' as const;
  available(): boolean { return true; }

  run(run: SandboxRun): Promise<SandboxResult> {
    const home = mkdtempSync(join(tmpdir(), 'janus-sbx-home-'));
    for (const mount of run.readOnlyMounts ?? []) { const target = join(run.workdir, mount.to); if (!existsSync(target)) { mkdirSync(dirname(target), { recursive: true }); symlinkSync(mount.from, target, 'dir'); } }
    // Entorno mínimo: ninguna variable del proceso de JANUS (claves, tokens, rutas de la bóveda) llega al código probado.
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: home, TMPDIR: home, LANG: 'C.UTF-8', CI: '1', NODE_ENV: 'test' };
    return runSteps(this, run, (argv, timeoutMs) => execute(argv[0]!, argv.slice(1), { cwd: run.workdir, env, timeoutMs }))
      .finally(() => { try { rmSync(home, { recursive: true, force: true }); } catch { /* temporal */ } });
  }
}

export interface DockerSandboxOptions { image: string; memory?: string; cpus?: string; dockerBinary?: string }

/** Argumentos de `docker run` para un paso. Exportado para poder auditarlo y probarlo sin Docker. */
export function dockerRunArgs(options: DockerSandboxOptions, run: Pick<SandboxRun, 'workdir' | 'readOnlyMounts'>, argv: readonly string[]): string[] {
  if (!/^[a-z0-9][a-z0-9._/:@-]{0,199}$/i.test(options.image)) throw new Error('docker image name is not valid');
  const mounts = (run.readOnlyMounts ?? []).flatMap((mount) => {
    if (mount.to.includes('..') || mount.to.startsWith('/')) throw new Error('read-only mount target is not valid');
    return ['-v', `${mount.from}:/work/${mount.to}:ro`];
  });
  return [
    'run', '--rm',
    '--network', 'none',                 // sin red: el código probado no puede llamar a ningún servicio
    '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--pids-limit', '256', '--memory', options.memory ?? '1g', '--cpus', options.cpus ?? '1',
    '--user', '1000:1000', '-e', 'HOME=/tmp', '-e', 'CI=1', '-e', 'NODE_ENV=test',
    '-v', `${run.workdir}:/work:rw`, ...mounts, '-w', '/work',
    options.image, ...argv,
  ];
}

export class DockerSandboxDriver implements SandboxDriver {
  readonly name = 'docker';
  readonly isolation = 'container' as const;
  constructor(private readonly options: DockerSandboxOptions) {}

  available(): boolean {
    try { return spawnSync(this.options.dockerBinary ?? 'docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 8000, stdio: 'ignore' }).status === 0; } catch { return false; }
  }

  run(run: SandboxRun): Promise<SandboxResult> {
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' };
    return runSteps(this, run, (argv, timeoutMs) => execute(this.options.dockerBinary ?? 'docker', dockerRunArgs(this.options, run, argv), { env, timeoutMs }));
  }
}

/** Elige el aislamiento más fuerte disponible y lo dice. `requireContainer` impide caer al proceso sin avisar. */
export function selectSandboxDriver(drivers: readonly SandboxDriver[], options: { requireContainer?: boolean } = {}): SandboxDriver {
  const container = drivers.find((driver) => driver.isolation === 'container' && driver.available());
  if (container) return container;
  if (options.requireContainer) throw new Error('No hay un sandbox de contenedor disponible en este equipo (Docker no responde).');
  const fallback = drivers.find((driver) => driver.available());
  if (!fallback) throw new Error('No hay ningún sandbox disponible.');
  return fallback;
}

/* ───────────────────────────── Cambio propuesto → probado → commit preparado ───────────────────────────── */

export interface FileChange { path: string; content?: string; delete?: boolean }

export interface ChangeProposal {
  id: string;
  /** Repositorio origen (carpeta local con git). Solo se LEE: el trabajo ocurre en un clon efímero. */
  repoDir: string;
  baseRef?: string;
  summary: string;
  changes: readonly FileChange[];
  /** Comprobaciones a ejecutar en el sandbox tras aplicar el cambio (p. ej. typecheck y pruebas). */
  checks: readonly (readonly string[])[];
  dependencyDirs?: readonly string[];
  timeoutMs?: number;
}

export interface PreparedChange {
  id: string;
  status: 'ready' | 'rejected';
  reason?: string;
  sandbox: SandboxResult | null;
  /** Carpeta del clon con el commit preparado (solo si `ready`). Se elimina con `discard`. */
  workdir?: string;
  branch?: string;
  commit?: string;
  filesChanged: string[];
  diffStat?: string;
}

const PROTECTED_BRANCH = /^(main|master|production|prod|release|live|gh-pages)$/i;
const FORBIDDEN_PATH = /(^|\/)(\.git(\/|$)|\.env(\.|$)|.*\.(pem|key|p12|pfx|keystore)$|id_(rsa|ed25519)|secrets?(\/|\.)|credentials?(\/|\.)|\.npmrc$|\.netrc$)/i;

export function validateChangePath(path: string): string {
  const clean = normalize(path).split(sep).join('/');
  if (!path || path.length > 300 || clean.startsWith('/') || clean.startsWith('../') || clean === '..' || clean.includes('/../') || /^[A-Za-z]:/.test(clean) || path.includes('\0')) throw new Error(`ruta no permitida: ${path.slice(0, 80)}`);
  if (FORBIDDEN_PATH.test(clean)) throw new Error(`ruta protegida (secretos o control de versiones): ${clean.slice(0, 80)}`);
  return clean;
}

function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): { ok: boolean; out: string } {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 60_000, env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: tmpdir(), GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', ...env } });
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

export interface ChangePipelineOptions {
  driver: SandboxDriver;
  author?: { name: string; email: string };
  /** Líneas finales del mensaje de commit (atribución), si aplica. */
  trailers?: readonly string[];
}

export class ChangePipeline {
  constructor(private readonly options: ChangePipelineOptions) {}

  /** Clona, aplica, prueba en el sandbox y, solo si todo pasa, deja el commit preparado en una rama propia. */
  async propose(proposal: ChangeProposal): Promise<PreparedChange> {
    if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(proposal.id)) throw new Error('change id is not valid');
    if (!proposal.summary.trim()) throw new Error('change summary is required');
    if (!proposal.changes.length || proposal.changes.length > 200) throw new Error('a change needs between 1 and 200 files');
    if (!proposal.checks.length) throw new Error('a change cannot be prepared without checks');
    const files = proposal.changes.map((change) => ({ ...change, path: validateChangePath(change.path) }));
    for (const change of files) if (!change.delete && typeof change.content !== 'string') throw new Error(`falta el contenido de ${change.path}`);
    const filesChanged = files.map((change) => change.path);
    const workdir = mkdtempSync(join(tmpdir(), 'janus-change-'));
    const reject = (reason: string, sandbox: SandboxResult | null): PreparedChange => { rmSync(workdir, { recursive: true, force: true }); return { id: proposal.id, status: 'rejected', reason, sandbox, filesChanged }; };

    // Clon local: contiene SOLO lo versionado. Archivos sin seguimiento (como .env) no entran.
    const clone = git(tmpdir(), ['clone', '--quiet', '--no-hardlinks', ...(proposal.baseRef ? ['--branch', proposal.baseRef] : []), proposal.repoDir, workdir]);
    if (!clone.ok) return reject(`no se pudo clonar el repositorio: ${clone.out.slice(0, 200)}`, null);
    const branch = `janus/change-${proposal.id}`;
    if (!git(workdir, ['checkout', '--quiet', '-b', branch]).ok) return reject('no se pudo crear la rama de trabajo', null);
    for (const change of files) {
      const target = join(workdir, change.path);
      if (change.delete) rmSync(target, { force: true });
      else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, change.content!, 'utf8'); }
    }
    const sandbox = await this.options.driver.run({
      workdir, commands: proposal.checks, ...(proposal.timeoutMs ? { timeoutMs: proposal.timeoutMs } : {}),
      readOnlyMounts: (proposal.dependencyDirs ?? []).map((dir) => ({ from: join(proposal.repoDir, validateChangePath(dir)), to: validateChangePath(dir) })).filter((mount) => existsSync(mount.from)),
    });
    if (!sandbox.ok) {
      const failed = sandbox.steps.at(-1);
      return reject(failed?.timedOut ? 'las comprobaciones agotaron el tiempo' : `falló «${failed?.argv.join(' ').slice(0, 120)}» (código ${failed?.exitCode})`, sandbox);
    }
    // Solo se confirman las rutas declaradas: lo que generen las pruebas (cachés, informes) no entra en el commit.
    const author = this.options.author ?? { name: 'JANUS', email: 'janus@localhost' };
    const identity = { GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email, GIT_COMMITTER_NAME: author.name, GIT_COMMITTER_EMAIL: author.email };
    const add = git(workdir, ['add', '-A', '--', ...filesChanged]);
    if (!add.ok) return reject(`no se pudieron preparar los archivos: ${add.out.slice(0, 200)}`, sandbox);
    if (git(workdir, ['diff', '--cached', '--quiet']).ok) return reject('el cambio no modifica nada', sandbox);
    const message = [proposal.summary.trim().slice(0, 100), '', `Cambio ${proposal.id} preparado por JANUS tras pasar ${sandbox.steps.length} comprobación(es) en sandbox (${sandbox.driver}, aislamiento: ${sandbox.isolation}).`, ...(this.options.trailers?.length ? ['', ...this.options.trailers] : [])].join('\n');
    const commit = git(workdir, ['commit', '--quiet', '--no-verify', '-m', message], identity);
    if (!commit.ok) return reject(`no se pudo crear el commit: ${commit.out.slice(0, 200)}`, sandbox);
    return { id: proposal.id, status: 'ready', sandbox, workdir, branch, commit: git(workdir, ['rev-parse', 'HEAD']).out, filesChanged, diffStat: git(workdir, ['show', '--stat', '--format=', 'HEAD']).out.slice(0, 2000) };
  }

  /**
   * Empuja la rama preparada al remoto indicado. Exige una aprobación humana ya concedida y nunca toca ramas protegidas:
   * llegar a producción es siempre otro paso, con su propia aprobación (fusión o despliegue).
   */
  publish(prepared: PreparedChange, input: { remoteUrl: string; approval: { approvalId: string; approved: boolean } }): { ok: boolean; out: string } {
    if (prepared.status !== 'ready' || !prepared.workdir || !prepared.branch) throw new Error('el cambio no está preparado');
    if (!input.approval?.approved || !/^approval_/.test(input.approval.approvalId)) throw new Error('publicar un cambio exige la aprobación del CEO');
    if (PROTECTED_BRANCH.test(prepared.branch) || !prepared.branch.startsWith('janus/change-')) throw new Error('JANUS no empuja a ramas protegidas');
    if (!/^(https:\/\/|git@|\/|file:\/\/)/.test(input.remoteUrl) || /\s/.test(input.remoteUrl)) throw new Error('remoto no válido');
    return git(prepared.workdir, ['push', '--quiet', input.remoteUrl, `${prepared.branch}:${prepared.branch}`]);
  }

  discard(prepared: PreparedChange): void {
    if (prepared.workdir) rmSync(prepared.workdir, { recursive: true, force: true });
  }
}
