import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { evaluateInstructionAudit, type InstructionAudit } from '../packages/core/src/instruction-audit.js';
const path = 'config/instruction-audit.json';
const audit = JSON.parse(readFileSync(path, 'utf8')) as InstructionAudit;
const library = JSON.parse(readFileSync('config/founder-reference-library.json', 'utf8')) as { records: Array<{ kind: string; classification: string; subject: string }> };
const subjects = library.records.filter(r => r.kind === 'policy' && r.classification === 'current').map(r => r.subject);
const result = evaluateInstructionAudit(audit, subjects, existsSync);
for (const ref of ['HEAD', 'HEAD^']) {
  const previous = spawnSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  if (previous.status === 0) {
    const checked = evaluateInstructionAudit(audit, subjects, existsSync, JSON.parse(previous.stdout) as InstructionAudit);
    result.errors.push(...checked.errors.filter(e => !result.errors.includes(e)));
  }
}
result.valid = result.errors.length === 0;
if (!result.valid) result.allInstructionsImplemented = false;
console.log('JANUS · RECONCILIACIÓN DE INSTRUCCIONES');
console.log(`Catálogo válido: ${result.valid ? 'SÍ' : 'NO'} · grupos de requisitos verificados en código: ${result.verifiedInCode}/${result.knownRequirements}`);
console.log(`Contratos históricos sin reconciliar: ${result.unreconciledLegacy}`);
console.log(`Historial íntegro de ambos proyectos: ${result.fullProjectHistoriesAvailable ? 'disponible' : 'NO DISPONIBLE; auditoría no exhaustiva'}`);
console.log(`Todas las instrucciones implementadas: ${result.allInstructionsImplemented ? 'SÍ' : 'NO ACREDITADO'}`);
if (!process.argv.includes('--summary')) for (const r of result.remaining) console.log(`- ${r.id}: ${r.title} [${r.status}] · ${r.remaining || 'requiere evidencia'}`);
for (const error of result.errors) console.error(error);
process.exitCode = !result.valid || (process.argv.includes('--require-complete') && !result.allInstructionsImplemented) ? 2 : 0;
