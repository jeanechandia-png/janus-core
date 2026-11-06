/**
 * Preflight before editing JANUS. Read-only except for updating the selected
 * remote tracking ref. Never merges, rebases, pushes or deploys.
 *
 * Usage:
 *   npm run continuity:guard
 *   npm run continuity:guard -- --base=claude/companion-escena-3d
 *   npm run continuity:guard -- --offline
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { evaluateContinuityGate, repositoryFromGitRemote, CANONICAL_JANUS_REPOSITORY } from '../packages/core/src/continuity-guard.js';

function readGit(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8', timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch { return undefined; }
}

function die(reason: string): never {
  console.error('BLOQUEADO:', reason);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--offline' && !arg.startsWith('--base='))) {
  die('Usa solamente --offline o --base=nombre-de-rama.');
}
const baseArgs = args.filter((arg) => arg.startsWith('--base='));
if (baseArgs.length > 1) die('Indica una sola rama base.');
const base = baseArgs[0]?.slice('--base='.length) ?? 'main';
if (!base || base.startsWith('-') || base.startsWith('/') ||
    !/^[a-zA-Z0-9._/-]+$/.test(base) || base.includes('..') ||
    base.includes('//') || base.endsWith('/') || base.endsWith('.lock')) {
  die('La rama base tiene un nombre no válido.');
}
const offlineAllowed = args.includes('--offline');
const originUrl = readGit(['remote', 'get-url', 'origin']);
const branch = readGit(['branch', '--show-current']);
const headSha = readGit(['rev-parse', '--verify', 'HEAD']);
const requiredFilesPresent = [
  'START_HERE.md', 'docs/PROJECT_MAP.md', 'docs/STATE.md',
  'packages/core/src/continuity.ts',
].every((file) => existsSync(file));

let fetchVerified = false;
let baseSha: string | undefined;
let baseAncestor = false;
if (repositoryFromGitRemote(originUrl) === CANONICAL_JANUS_REPOSITORY && headSha) {
  const outcome = spawnSync('git', [
    'fetch', '--quiet', '--no-tags', 'origin',
    `+refs/heads/${base}:refs/remotes/origin/${base}`,
  ], {
    encoding: 'utf8', timeout: 30_000,
    stdio: ['ignore', 'ignore', 'ignore'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  fetchVerified = outcome.status === 0;
  if (fetchVerified) {
    baseSha = readGit(['rev-parse', '--verify', `refs/remotes/origin/${base}`]);
    if (baseSha) {
      const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', baseSha, headSha], {
        encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'ignore', 'ignore'],
      });
      baseAncestor = ancestry.status === 0;
    }
  }
}

const result = evaluateContinuityGate({
  originUrl, branch, headSha, baseRef: `origin/${base}`, baseSha,
  baseAncestor, fetchVerified, offlineAllowed, requiredFilesPresent,
});
const dirty = readGit(['status', '--porcelain']);
console.log('JANUS — CONTROL DE CONTINUIDAD');
console.log(`Repositorio: ${result.repository ?? '(no verificado)'}`);
console.log(`Rama local: ${branch || '(sin rama)'}`);
console.log(`HEAD: ${headSha ?? '(sin commit)'}`);
console.log(`Base: origin/${base} ${baseSha ?? '(no verificada)'}`);
console.log(`Cambios locales: ${dirty ? dirty.split('\\n').length : 0}`);
console.log(`ESTADO: ${result.state.toUpperCase()}`);
for (const reason of result.reasons) console.log(`- ${reason}`);
if (result.state === 'ready') {
  console.log('Antes de escribir, revisa npm run continuity, PR abiertos y el último handoff; revalida antes de publicar.');
} else {
  process.exitCode = 2;
}
