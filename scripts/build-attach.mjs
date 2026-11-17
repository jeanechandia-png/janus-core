#!/usr/bin/env node
// Empaqueta el módulo chat-attachments (botón «+») como un ES module para la PWA: apps/pwa/attach.js.
// El resultado SE VERSIONA (la PWA se sirve sin paso de compilación). Uso:
//   node scripts/build-attach.mjs           → escribe apps/pwa/attach.js
//   node scripts/build-attach.mjs --check   → falla (código 1) si el archivo versionado no coincide con el código fuente
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = `${root}/apps/pwa/attach.js`;
const banner = '/* Generado por scripts/build-attach.mjs desde packages/modules/chat-attachments. No editar a mano. Incluye jsQR (Apache-2.0). */\n';

export async function buildAttachBundle() {
  const result = await build({
    entryPoints: [`${root}/packages/modules/chat-attachments/src/web.ts`],
    bundle: true, write: false, format: 'esm', target: 'es2020', platform: 'browser', minify: true, legalComments: 'none',
    logLevel: 'warning',
  });
  return banner + result.outputFiles[0].text;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = await buildAttachBundle();
  if (process.argv.includes('--check')) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
    if (current !== text) {
      console.error('apps/pwa/attach.js está desactualizado: ejecuta `npm run build:attach`.');
      process.exit(1);
    }
    console.log('apps/pwa/attach.js al día');
  } else {
    writeFileSync(out, text);
    console.log(`${out}  ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB`);
  }
}
