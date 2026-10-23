#!/usr/bin/env node
/**
 * Copia consistente de la base de datos de JANUS (SQLite) con `VACUUM INTO`, verificada con `integrity_check`
 * y con rotación (por defecto se conservan 7). Funciona con el runtime encendido (lectura sin bloquearlo).
 *
 * Variables: JANUS_ENV_FILE (lee JANUS_DB de ahí), JANUS_DB, JANUS_BACKUP_DIR, JANUS_BACKUP_KEEP,
 *            JANUS_BACKUP_STAMP (solo para pruebas), JANUS_BACKUP_RCLONE_REMOTE (opcional, INACTIVO por defecto:
 *            si existe y `rclone` está instalado, copia el archivo allí; requiere que Jean autorice y configure el destino).
 * Nunca imprime el contenido de la base de datos ni secretos.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadEnvFile } from '../lib/env-file.mjs';

const envFile = process.env.JANUS_ENV_FILE?.trim();
if (envFile) loadEnvFile(envFile);

const dbPath = process.env.JANUS_DB?.trim() || 'data/janus.db';
if (dbPath === ':memory:' || !existsSync(dbPath)) {
  console.log(`[backup] no hay base de datos en ${dbPath}; nada que copiar.`);
  process.exit(0);
}
const dir = process.env.JANUS_BACKUP_DIR?.trim() || join(dirname(dbPath), 'backups');
const keep = Math.max(1, Number(process.env.JANUS_BACKUP_KEEP) || 7);
const stamp = process.env.JANUS_BACKUP_STAMP?.trim() || new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
mkdirSync(dir, { recursive: true });
const target = join(dir, `janus-${stamp}.db`);
if (existsSync(target)) rmSync(target);

let source;
try {
  source = new DatabaseSync(dbPath, { readOnly: true });
  source.prepare('VACUUM INTO ?').run(target);
} finally {
  source?.close();
}

const check = new DatabaseSync(target, { readOnly: true });
const verdict = check.prepare('PRAGMA integrity_check').get();
check.close();
if (!verdict || Object.values(verdict)[0] !== 'ok') {
  rmSync(target, { force: true });
  console.error('[backup] la copia NO pasó integrity_check y se descartó.');
  process.exit(1);
}

const copies = readdirSync(dir).filter((name) => /^janus-.*\.db$/.test(name)).sort();
for (const old of copies.slice(0, Math.max(0, copies.length - keep))) rmSync(join(dir, old), { force: true });
console.log(`[backup] copia verificada: ${target} (se conservan ${Math.min(keep, copies.length)}).`);

const remote = process.env.JANUS_BACKUP_RCLONE_REMOTE?.trim();
if (remote) {
  const result = spawnSync('rclone', ['copy', target, remote], { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error('[backup] la copia local está bien, pero no se pudo enviar al destino remoto.');
    process.exit(2);
  }
  console.log('[backup] copia enviada al destino remoto configurado.');
}
