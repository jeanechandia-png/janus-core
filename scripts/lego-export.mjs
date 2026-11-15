#!/usr/bin/env node
// Exporta piezas LEGO de packages/modules a otro producto (IBA, ChatBox…) y deja un candado de integridad.
//
//   node scripts/lego-export.mjs --to <carpeta-destino> <pieza> [<pieza>…]     copia y sella
//   node scripts/lego-export.mjs --check <carpeta-destino>                       verifica que nadie las ha tocado
//
// Por qué: una pieza se escribe UNA vez aquí (fuente única) y los demás productos la reciben tal cual. El candado
// (lego.lock.json: versión, commit de origen y SHA-256 de cada archivo) impide que una copia diverja en silencio:
// si alguien edita la copia, --check falla y la mejora debe hacerse en la fuente y volver a exportarse.
// Junto a las piezas se deja `verify-lego.mjs`, sin dependencias, para que el producto destino lo ejecute en sus pruebas.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const walk = (dir) => readdirSync(dir).sort().flatMap((name) => { const full = join(dir, name); return statSync(full).isDirectory() ? walk(full) : [full]; });
const posix = (path) => path.split(sep).join('/');

/** Verifica una carpeta exportada. Devuelve la lista de problemas (vacía = íntegra). */
export function verifyExport(target) {
  const problems = [];
  const lockPath = join(target, 'lego.lock.json');
  if (!existsSync(lockPath)) return ['falta lego.lock.json'];
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  for (const [id, piece] of Object.entries(lock.pieces ?? {})) {
    const dir = join(target, id);
    const present = existsSync(dir) ? walk(dir).map((file) => posix(relative(dir, file))) : [];
    for (const [file, hash] of Object.entries(piece.files)) {
      if (!present.includes(file)) problems.push(`${id}: falta ${file}`);
      else if (sha(join(dir, file)) !== hash) problems.push(`${id}: ${file} fue modificado fuera de la fuente`);
    }
    for (const file of present) if (!(file in piece.files)) problems.push(`${id}: archivo añadido que no viene de la fuente: ${file}`);
  }
  return problems;
}

const VERIFY_STANDALONE = `// GENERADO por janus-core/scripts/lego-export.mjs — no editar. Verifica que las piezas LEGO de esta carpeta
// son idénticas a su fuente (janus-core). Uso: node verify-lego.mjs   (sale con código 1 si algo cambió)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const walk = (dir) => readdirSync(dir).sort().flatMap((name) => { const full = join(dir, name); return statSync(full).isDirectory() ? walk(full) : [full]; });
export function verifyLego(target = here) {
  const problems = []; const lock = JSON.parse(readFileSync(join(target, 'lego.lock.json'), 'utf8'));
  for (const [id, piece] of Object.entries(lock.pieces)) {
    const dir = join(target, id); const present = existsSync(dir) ? walk(dir).map((file) => relative(dir, file).split(sep).join('/')) : [];
    for (const [file, hash] of Object.entries(piece.files)) {
      if (!present.includes(file)) problems.push(id + ': falta ' + file);
      else if (createHash('sha256').update(readFileSync(join(dir, file))).digest('hex') !== hash) problems.push(id + ': ' + file + ' fue modificado fuera de la fuente (janus-core)');
    }
    for (const file of present) if (!(file in piece.files)) problems.push(id + ': archivo añadido que no viene de la fuente: ' + file);
  }
  return problems;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = verifyLego();
  if (problems.length) { console.error('LEGO_LOCK_MISMATCH\\n' + problems.join('\\n')); process.exit(1); }
  console.log('lego ok');
}
`;

export function exportPieces(target, ids, options = {}) {
  mkdirSync(target, { recursive: true });
  const lockPath = join(target, 'lego.lock.json');
  const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : { schema: 'lego-lock-v1', source: 'jeanechandia-png/janus-core', pieces: {} };
  let commit = options.commit;
  if (!commit) { try { commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { commit = 'unknown'; } }
  for (const id of ids) {
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id)) throw new Error(`nombre de pieza no válido: ${id}`);
    const source = join(root, 'packages', 'modules', id);
    const manifestPath = join(source, 'module.json');
    if (!existsSync(manifestPath)) throw new Error(`no existe la pieza ${id}`);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if ((manifest.dependencies ?? []).length) throw new Error(`${id} tiene dependencias: no es exportable tal cual`);
    const destination = join(target, id);
    rmSync(destination, { recursive: true, force: true });
    cpSync(source, destination, { recursive: true });
    const files = Object.fromEntries(walk(destination).map((file) => [posix(relative(destination, file)), sha(file)]));
    lock.pieces[id] = { version: manifest.version, sourceCommit: commit, files };
  }
  lock.pieces = Object.fromEntries(Object.entries(lock.pieces).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  writeFileSync(join(target, 'verify-lego.mjs'), VERIFY_STANDALONE);
  return lock;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const flag = args[0]; const target = args[1] ? resolve(args[1]) : '';
  if (flag === '--check' && target) {
    const problems = verifyExport(target);
    if (problems.length) { console.error(`LEGO_LOCK_MISMATCH\n${problems.join('\n')}`); process.exit(1); }
    console.log('lego ok');
  } else if (flag === '--to' && target && args.length > 2) {
    const lock = exportPieces(target, args.slice(2));
    console.log(Object.entries(lock.pieces).map(([id, piece]) => `${id}@${piece.version} (${Object.keys(piece.files).length} archivos)`).join('\n'));
  } else {
    console.error('uso: lego-export.mjs --to <destino> <pieza>…   |   lego-export.mjs --check <destino>');
    process.exit(2);
  }
}
