/**
 * Cross-agent continuity report. Read-only. Run first when you arrive at the project:
 *   npm run continuity
 * Prints: where you are, what exists (LEGO modules, ADRs), open PRs as a stack (if `gh` is available),
 * ADR number collisions across remote branches, and the current handoff from docs/STATE.md.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findAdrCollisions, latestHandoff, nextFreeAdrNumber, stackOutline, type OpenPr, type RefFile } from '../packages/core/src/continuity-scan.js';

function run(command: string, args: string[]): string | undefined {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000 }).trim(); } catch { return undefined; }
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']) ?? '(sin git)';
const head = run('git', ['log', '-1', '--format=%h %s']) ?? '';
console.log('🧭 CONTINUIDAD JANUS');
console.log(`AHORA: rama ${branch} · ${head}`);
const dirty = run('git', ['status', '--porcelain']);
console.log(`Cambios sin guardar: ${dirty ? dirty.split('\n').length : 0}`);

run('git', ['fetch', '--quiet', 'origin']);
const remotes = (run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin']) ?? '').split('\n').filter((r) => r && !r.endsWith('/HEAD'));
const files: RefFile[] = [];
for (const ref of remotes) {
  for (const path of (run('git', ['ls-tree', '-r', '--name-only', ref, 'docs']) ?? '').split('\n')) if (path) files.push({ ref, path });
}
for (const path of existsSync('docs') ? readdirSync('docs').map((n) => `docs/${n}`) : []) files.push({ ref: 'WORKTREE', path });

console.log('\n📦 MÓDULOS LEGO (reutiliza antes de crear):');
if (existsSync('packages/modules')) {
  for (const name of readdirSync('packages/modules')) {
    const manifest = join('packages/modules', name, 'module.json');
    if (!existsSync(manifest)) continue;
    const m = JSON.parse(readFileSync(manifest, 'utf8')) as { id: string; version: string; summary: string };
    console.log(`  • ${m.id}@${m.version} — ${m.summary}`);
  }
}

const prsJson = run('gh', ['api', 'repos/jeanechandia-png/janus-core/pulls?state=open&per_page=50']);
console.log('\n🔀 PR ABIERTOS (pila):');
if (prsJson) {
  const prs = (JSON.parse(prsJson) as Array<{ number: number; head: { ref: string }; base: { ref: string }; title: string; draft?: boolean }>)
    .map((pr): OpenPr => ({ number: pr.number, head: pr.head.ref, base: pr.base.ref, title: pr.title, ...(pr.draft ? { draft: true } : {}) }));
  console.log(stackOutline(prs).map((line) => `  ${line}`).join('\n') || '  (ninguno)');
} else {
  console.log('  (gh no disponible: consulta GitHub → Pull requests)');
}

console.log('\n⚠️ COLISIONES DE ADR ENTRE RAMAS:');
// Branches already contained in origin/main are history: their ADR files live in main (possibly renamed), so they cannot collide.
const merged = new Set(remotes.filter((ref) => ref !== 'origin/main' && run('git', ['merge-base', '--is-ancestor', ref, 'origin/main']) !== undefined));
const collisions = findAdrCollisions(files.filter((file) => !merged.has(file.ref)));
if (collisions.length === 0) console.log('  Ninguna.');
for (const c of collisions) {
  console.log(`  ADR-${c.number}:`);
  for (const f of c.files) console.log(`    - ${f.path} (${f.refs.slice(0, 3).join(', ')}${f.refs.length > 3 ? ` +${f.refs.length - 3} más` : ''})`);
}
console.log(`  Siguiente número libre: ADR-${nextFreeAdrNumber(files)}`);

console.log('\n📝 HANDOFF VIGENTE (docs/STATE.md):');
if (existsSync('docs/STATE.md')) {
  const handoff = latestHandoff(readFileSync('docs/STATE.md', 'utf8'));
  if (handoff) {
    const body = handoff.body.filter((line) => line.trim() !== '').slice(0, 14);
    console.log([handoff.heading, ...body].map((line) => `  ${line}`).join('\n'));
  } else {
    console.log('  (sin handoff registrado: añade uno al terminar tu sesión)');
  }
}
console.log('\n✅ Antes de editar: lee START_HERE.md y docs/PROJECT_MAP.md; continúa desde el último commit; no dupliques módulos.');
