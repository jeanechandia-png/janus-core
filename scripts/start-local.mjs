#!/usr/bin/env node
/** Starts the Janus runtime with variables from .env.local (private, ignored by git). */
import { spawn } from 'node:child_process';
import { loadEnvFile } from './lib/env-file.mjs';

const envFile = process.env.JANUS_ENV_FILE?.trim() || '.env.local';
const { loaded, keys } = loadEnvFile(envFile);
console.log(loaded ? `Janus: ${keys.length} variables cargadas de ${envFile} (valores ocultos).` : `Janus: no existe ${envFile}; se usan solo las variables del sistema.`);
const child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => { process.exitCode = code ?? 0; });
