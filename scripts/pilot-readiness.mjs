#!/usr/bin/env node
/**
 * Non-destructive JANUS pilot gate. --validate is CI schema verification;
 * --require-review-ready is for a proposed pilot release.
 * A passing record is never proof of running a product in production.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { assessPilotReadiness } from '../packages/core/src/pilot-readiness.mjs';

const args = process.argv.slice(2);
if (args.some(arg => !['--validate', '--json', '--require-review-ready'].includes(arg))) {
  console.error('Opciones: --validate, --json, --require-review-ready');
  process.exit(2);
}
const path = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/PILOT_READINESS.json');
let data;
try { data = JSON.parse(readFileSync(path, 'utf8')); }
catch (error) {
  console.error('INVALID_RECORD: no se pudo leer el registro de piloto:', error.message);
  process.exit(2);
}
const result = assessPilotReadiness(data);
if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log('JANUS PILOT GATE: ' + result.status);
  console.log('Es una comprobación del registro, NO una prueba real de despliegue ni de iPhone.');
  if (result.failed.length) console.log('Bloqueado:', result.failed.join(', '));
  if (result.pending.length) console.log('Sin ejecutar:', result.pending.join(', '));
  for (const error of result.errors) console.error('Error:', error);
}
if (result.status === 'INVALID_RECORD' ||
    (args.includes('--require-review-ready') && result.status !== 'REVIEW_REQUIRED')) {
  process.exitCode = 2;
}
